# Code review of `web/` and `server/`

Branch `review/code-quality` (from `web/integration` @ `a4a9c7c`). Scope: all of `web/src`, `web/tests`, `server/`.
**Not reviewed:** the shop (`app/[locale]/shop`, `components/shop`, `lib/shop`), which is being rewritten on
`feat/shop-features`. `client/` and `client-next/` were not touched.

Status column: **fixed** = changed on this branch (with a test where one is possible), **open** = left for the
owner or another branch, with a recommendation.

## 1. Architecture assessment

What is good and should be kept:

- **Server-rendered by default.** Pages are async server components; client components are the leaves that need
  state (flows, carousel, lightbox, live player). Static generation with `revalidate` where data changes.
- **One rule per concern.** Money is decided on the server (`server/services/pricing.js`); `web/src/lib/api.ts`
  validates every API answer with zod; `checkout/validation.ts` mirrors the API's limits so the API never refuses
  what the form accepted; pure logic (`galleryLogic`, `liveSchedule`, `reviewRules`, `verse`, `flames`) is kept out of
  React and unit tested.
- **Design system is real.** Tokens in `tokens.css`, `ui-*` blocks in `ui.css`, logical CSS properties everywhere
  (zero `left`/`right`/`margin-left` in the 40+ stylesheets), `prefers-reduced-motion` respected.
- **i18n discipline.** No visible English in JSX; 11 files with identical key sets and placeholders, guarded by tests.
- **Server:** one error handler, `asyncHandler`, validation at the edge, CORS allow-list, rate limits, `helmet`.

What was weak (and is addressed in section 4):

- Each feature area (home, places, community, checkout) had grown its **own copy** of the same helpers: five JSON-LD
  serialisers, five metadata builders, five icon frames, four flame animations, three alert boxes, three copies of the
  reduced-motion check, two `NAZARETH_TIME_ZONE` constants, two "where is the reviewer from" functions.
- The language **proxy matcher was wrong** (section 2, B1), which no test covered.
- **No convention was enforced by a tool.** `CLAUDE.md` says "never hard-code colours/fonts, use logical properties,
  all text through next-intl", but nothing failed when someone did.

## 2. Findings

Severity: **High** = visitors or money affected now; **Medium** = wrong in a realistic situation; **Low** = polish or
a risk that needs an unusual situation.

### Correctness bugs

| ID | Sev | Where | Problem and reproduction | Status |
|---|---|---|---|---|
| B1 | **High** | `web/src/proxy.ts:9` (before) | The matcher string was `'/((?!api\|_next\|_vercel\|.*\..*).*)'`. In a JavaScript string `\.` is just `.`, so the pattern became `.*..*` and excluded **every path with at least one character**: only `/` reached the language proxy. Reproduction (production build): `GET /shop`, `/sites/latin`, `/latin` (an address of the old site) all answer **404** instead of redirecting to `/en/...`. Every legacy link and every shared link without a language was dead. | **fixed**: escaped twice; `tests/unit/shared.test.tsx` evaluates the matcher exactly as written in the file. |
| B2 | Medium | `components/home/Souvenirs.tsx:34` | `<Image src={p.img}>` with a product photo from any host other than `firebasestorage.googleapis.com` makes `next/image` **throw while rendering**, which takes down the whole home page (the checkout summary already guarded this with its own `canOptimize`). | **fixed**: `lib/images.ts` `isOptimizable()`; unknown hosts render `unoptimized`. Also used by the checkout summary. A test keeps the host list equal to `next.config.ts`. |
| B3 | Medium | `lib/apiClient.ts:19` | `await res.text()` sat outside the `try`: a connection that breaks while the body arrives **threw** out of `postJson`, so `useSaveAfterPayment` stayed on "saving" for a visitor who had already paid. No timeout either, so a sleeping Render instance hangs a form for as long as it likes. | **fixed**: never throws (`status 0` = no answer), optional `timeoutMs`, optional zod `schema` so `create_order` / `complete_order` answers are validated instead of cast. |
| B4 | Medium | `lib/api.ts:151` | A 200 answer that is not JSON (an HTML error page from a proxy) threw a bare `SyntaxError` instead of an `ApiError`, bypassing the callers' `ApiError` handling. | **fixed** (`502 ApiError`). |
| B5 | Medium | `lib/cart.tsx:59-70` | The stored cart was only checked for `_id`, `price`, `quantity` being an integer. A stored `quantity` of `0`, `-3` or `9999`, a negative price, or a non-string `name` reached the UI and the checkout request. Storage is shared between tabs and survives versions, so it is untrusted input. | **fixed**: `parseStoredCart()` keeps only well-formed lines (quantity 1-50, finite price >= 0, strings), one per product + colour. |
| B6 | Medium | `ui.css` `.ui-reveal` | Reveal sections start at `opacity: 0` and are shown by JavaScript. With scripting off (or a crawler that does not run it) every section below the hero is invisible. | **fixed**: `@media (scripting: none)` shows them. |
| B7 | Low | `components/community/ReviewForm.tsx:69` | The double-submit guard read `status`, which is still `idle` when a second submit event arrives in the same tick (double tap, Enter twice), so the review could be posted twice. | **fixed** (ref guard). |
| B8 | Low | `components/home/SitesCarousel.tsx:96-107` | After a mouse drag that ended outside the track no `click` follows, so `moved` stayed `true` and swallowed the next genuine click (a keyboard Enter on a card). | **fixed**. |
| B9 | Low | `candle/CandleFlow.tsx`, `checkout/CheckoutFlow.tsx` | E-mail/phone inputs have `dir="ltr"`; only the checkout aligned them to the end of the row on right-to-left pages, the candle form did not. | **fixed** once in `ui.css` (`.ui-input[dir='ltr']`), the checkout-only class is gone. |
| B10 | Low | `components/layout/LanguageSwitcher.tsx:53` | `aria-haspopup="true"` announces a menu, but the popup is a plain list of buttons; Escape closed it and left the focus on `<body>`. | **fixed** (`aria-controls`, focus returns to the trigger). |
| B11 | Medium | `components/community/liveSchedule.ts:20` | The only scheduled broadcast is **6 Oct 2024**, so `/live` is permanently "offline". Not a code bug, a content one. | **open**: owner must supply the schedule (add to `broadcasts`). |
| B12 | Low | `components/layout/SiteFooter.tsx:9` | The copyright year is computed when the (static) layout is built, so it only changes on a deploy. | open (low). |

### Security (web and server)

The `sec/hardening` branch owns security; items here are what a staff review found. Fixed items are kept small so
they merge cleanly.

| ID | Sev | Where | Finding | Status |
|---|---|---|---|---|
| S1 | **High** | `server/route/orderRoute.js` `newOrder` | **Nothing proves the order was paid.** Anyone can POST a valid body and get an `Order` row **and an e-mail sent to an address of their choosing** (`to: [email]`). The price is computed correctly, but an unpaid order looks identical to a paid one in the admin list. The old client has the same contract, so a fix must be backwards compatible: have `complete_order` remember the captured PayPal order id (collection, TTL) and make `newOrder` accept and require it from the new client. | **open** (design change). Mitigated: `newOrder`, `create_order`, `complete_order` are now rate limited per address. |
| S2 | Medium | `server/route/candleRoute.js:70` | Same open-relay shape: free-text name and an arbitrary recipient. `strictLimiter` (10 per 15 min) limits it; it also **awaits** the mail, so a stuck SMTP connection held the request for nodemailer's default 2 minutes. | **fixed** (SMTP timeouts 10/10/20 s). Recipient issue open with S1. |
| S3 | Medium | `server/route/orderRoute.js` (before) | `newOrder`, `create_order`, `complete_order` had only the global 200/15 min limit; each `create_order` costs two PayPal calls. | **fixed**: `orderLimiter` (20/h) and `paymentLimiter` (60/15 min), separate counters (`strictLimiter` is one counter shared by every route that uses it). |
| S4 | Medium | `server/services/paypalService.js` | A new OAuth token was requested for **every** create/capture (twice the calls, twice the failure points) and no PayPal call had a timeout. | **fixed**: token cached until a minute before it expires; every call has a 15 s timeout. |
| S5 | Medium | `server/route/adminRoute.js:12` | `{ "username": "a" }` or a non-string password made `bcrypt.compare` throw: a 500 and a stack trace in the log. A client-chosen username went raw into the log line (log injection). | **fixed** (401, no database query, `JSON.stringify`d and truncated in the log). |
| S6 | Low | `server/route/authRoute.js:10` | Shared-password compare used `!==` (timing). | **fixed** (`timingSafeEqual` over SHA-256 digests; non-strings refused). |
| S7 | Low | `server/route/prayerRoute.js:24` | `?size=-5` or `0` reached `.limit(-5)` / a negative `skip` and answered 500. | **fixed** (`size >= 1`). |
| S8 | Low | `components/community/actions.ts` | `revalidateReviews` is a public server action; anyone can call it in a loop to keep the reviews page rebuilding (each rebuild = an API request). | **fixed**: ignored when called again within 5 s (per instance, best effort). |
| S9 | **High (ops)** | `web/src/lib/config.ts:2,6` | `API_URL` defaults to the **production API** and `PAYPAL_CLIENT_ID` to a **sandbox** client id. A developer running `npm run dev` writes reviews and orders into production; a production deploy with `NEXT_PUBLIC_PAYPAL_CLIENT_ID` unset silently takes sandbox payments (customers "pay", no money moves). | **open**: require both variables when `NODE_ENV=production` on Netlify (fail the build), default the API to `http://localhost:5000` in development. Left alone because other branches rely on reading the live API in dev. |
| S10 | Medium | `server/app.js:55` | `credentials: true` with an origin allow-list is unnecessary (the API uses a bearer token, not cookies) and widens what a mistaken allow-list entry could do. | open (low risk). |
| S11 | Medium | `server/middleware`, `app.use(xss())` | `express-xss-sanitizer` HTML-escapes JSON bodies (that is where `&amp;` in stored image URLs came from, patched in `lib/api.ts`). Escaping belongs at output; at input it corrupts data (a name like `Tom & Jerry`). | open: drop it, rely on React's escaping and `express-mongo-sanitize`. |
| S12 | Low | `server/route/orderRoute.js:50` | `productName` and `color` of each order line are stored as the browser sent them; only `_id` and `quantity` are checked against the database. The admin may see a name the shop never sold. | open: take names from the database in `priceShopOrder`. |
| S13 | Low | `server/route/productRoute.js:8`, `prayerRoute.js:27` | `getAllProducts` is public and unbounded; `like/:id` has no limit beyond the global one. | open. |
| S14 | Medium | `next.config.ts` | No Content-Security-Policy yet (documented in ENGINEERING.md). | open (`sec/hardening`). |

### Race conditions, stale closures, memory leaks, hydration

Reviewed every timer, listener and observer; **no leak found**. Each `setInterval` (`useNow`), `addEventListener`,
`IntersectionObserver` (`Reveal`, `HeroVideo`, `StickyCta`), `ResizeObserver` (`SitesCarousel`), the `Audio` of
`SoundToggle` and the lightbox's scroll lock is released in its cleanup. No hydration mismatch found by reading:
everything time- or storage-dependent renders a server-safe value first (`useNow(serverNow)`, `useHydrated`,
`useSyncExternalStore` with a server snapshot, `ready` flag in the cart, poster-only hero).

Remaining low-risk items:

- `PayPalButtons` keeps the `createOrder` it was mounted with. If the cart changes in another tab while the PayPal
  buttons are on screen, the order is created for the old items. Rare; fix by remounting the panel when the payload
  changes (key). **open (low)**.
- `useNow.getSnapshot` returns the last tick; after a long time with no subscribers the first render of a revisited
  `/live` shows a stale time for one frame. **open (low)**.
- ISR can cache an error state: `Souvenirs` and `Voices` catch API failures and render a fallback; if the API is asleep
  during a regeneration the **fallback is cached for `revalidate` (up to an hour)**. Preferable: rethrow when a previous
  page exists so Next keeps serving it. **open (medium)**, needs a decision about the first build.

### Error handling gaps

- `postJson`, `getJson` fixed (B3, B4). `useSaveAfterPayment` relied on `postJson` not throwing; now true.
- After a successful PayPal capture the order is saved by a second request from the browser. If the visitor closes the
  tab in between, **the payment exists and the order does not** (the capture id is never sent to the server). This is the
  same root cause as S1; the fix is server-side (record the capture, create the order from it).
- Server: four routes answer `204` with a body (`orderRoute.js:22,70`, `contactRoute.js:54,66`); a 204 has no body and
  "not found" should be 404. Kept because the admin site may depend on it. **open**.

### Dead code

Removed: `data/places/seo.ts` duplicates (page metadata, breadcrumb, list, serialiser), `components/community/metadata.ts`,
two `JsonLd.tsx`, the home `Flame.tsx` (moved), three alert style blocks, four `flicker` keyframes, the self-redirects
`/tour -> /tour`, `/about -> /about`, the unused community `alert` icon, the `.ltr` class, an inline style.

Still present, deliberately: `components/ui/Stars.tsx` (no user yet; the shop rewrite is expected to use it);
`LEGACY_REDIRECTS` (only tests use it, `next.config.ts` keeps its own list; a test now keeps the two equal).

**Unused messages (42 keys, all legacy of the old site)**, listed in `tests/unit/i18n-usage.test.ts`: `site.tagline`,
`live.refresh_note`, `common.*`, `heroSection.{heading,subHeading,shopIcon,tourIcon}`, `cards.*`, `footer.{aboutUs,
aboutUsDescription,learnMore,contactUs,email,followInstagram,followFacebook,subscribeYoutube,credits,creditLink1,
creditLink2,copyright}`, `paypalComponent.{orderCancelled,thankYou,cost}`, `navbar.*`, `mapButton`, `confirmDetails`,
`confirmed`, `orderCancelled`. They were **not deleted** here (the brief for this branch allows only adding to message
files); the test fails if a key is deleted without updating the list, and fails if a *new* unused key appears.
Also 11 duplicated texts (for example `thankYou.gratitude` = `confirmationCandle.gratitude` = `paypalComponent.thankYou`).

### Duplicated logic (consolidated, behaviour unchanged)

| Was | Now |
|---|---|
| `serializeJsonLd` in `home/jsonLd`, `community/JsonLd`, `places/seo`, `shop/seo` + two `<JsonLd>` components + an inline `<script>` | `lib/jsonld.ts` + `components/ui/JsonLd.tsx` |
| Metadata builders `pageAlternates`, `flowMetadata`, `communityMetadata`, `pageMetadata`, `localeAlternates` (shop), inline in home/cart/layout | `lib/seo.ts` `pageMetadata()`, `pageAlternates()`, `localePath()`, `absoluteUrl()` (every page now also gets a Twitter card) |
| Breadcrumb / item-list / organisation JSON-LD written per page (4 copies of the organisation) | `lib/jsonld.ts` |
| Brand name `'Nazareth Holy Cross'` typed in 6 places | `SITE_NAME` in `lib/config.ts` |
| 5 SVG icon frames (`places`, `checkout`, `home`, `community`, shop) | `components/ui/SvgIcon.tsx`; `components/ui/icons.tsx` for check/alert |
| 3 alert/notice boxes (`checkout`, `ReviewForm`, `DonePanel`) | `components/ui/Notice.tsx` |
| 4 candle flames (`home/Flame`, checkout, `VisitCard`, candle visual) | `components/ui/Flame.tsx` (`sm`/`md`/`lg`, `ink`) |
| `FIELDS` list + `id()` with a `!` + the same `text()` renderer in 2 flows | `fieldOrder()`, `<TextField>` in `checkout/Field.tsx` |
| `wholeUsd` in `DonateFlow` | `formatUsdWhole` in `lib/pricing.ts` |
| 3 reduced-motion checks | `lib/motion.ts` |
| `NAZARETH_TIME_ZONE` in `verse.ts` and `liveSchedule.ts` | `lib/time.ts` |
| `placeOf` and `reviewerPlace` | `lib/reviews.ts` |
| `canOptimize` in checkout | `lib/images.ts` |

Not consolidated (needs the shop branch): skeletons and state cards (`components/shop/Skeletons`, `StateCard`), the shop's
own `localeAlternates` and `jsonLdHtml`. Once `feat/shop-features` is merged they should move to `ui/` and the shop
should import `lib/seo` / `lib/jsonld`.

### Naming and folder consistency

- Domain folders (`checkout`, `community`, `home`, `places`, `shop`) mix components, hooks, data and pure logic.
  Acceptable at this size; the shared pieces now live in `components/ui` and `lib`.
- `components/places/icons.tsx` vs `components/community/Icon.tsx` vs `checkout/icons.tsx` used different styles; all
  draw on `SvgIcon` now. The community set (name -> shape map) is the only one that is not exported per icon.
- `data/places/` holds data **and** is imported by components; `components/community/recordings.ts` and
  `liveSchedule.ts` are data too. Consider one `src/data/` for all content.
- Page folders correctly keep one-off client components next to their page (`CandleFlow`, `CheckoutFlow`).

### i18n key hygiene

- All 11 files: identical keys and placeholders (existing test). Only 6-7 values per language equal the English text and
  they are product names, `site.name` or the legacy keys above, so **no untranslated visible key** was found.
- **No hard-coded visible English** was found in JSX; the lint rule below keeps it that way.
- `i18n/request.ts` merges English under every language, so a missing key falls back instead of showing a raw key.
- `layout.tsx:47` `NextIntlClientProvider` sends the **whole message tree** of the language to the browser on every page
  (all namespaces, shop included). Medium for performance: pass only the namespaces client components use. **open**
  (performance branch).

### CSS duplication and token misuse

- Was: 18 raw `#hex` / `rgba()` values outside `tokens.css` (`ui.css`, header, footer, language menu, stars). Now **none**;
  new tokens `--white`, `--night-deep`, `--gold-light`, `--on-gold`, `--symbols`; translucent colours use `color-mix()`.
- One system font stack lived in `Stars.module.css` (`system-ui`): now `--symbols`.
- `flicker` keyframes (4 copies), `kenburns` (2), shimmer (`PlaceGallery` vs `ui-shimmer`) were duplicates; flame is
  merged. **open (low):** `kenburns` (HomeHero, PlaceHero) and `PlaceGallery` shimmer.
- `scroll-margin-top: 68px` literals in the home sections duplicate `--header-h`. **open (low).**

### Accessibility anti-patterns

Fixed: B6, B10. Checked and fine: skip link, one `<h1>` per page, labelled landmarks, `aria-current`, focus return in
lightbox and flows, `role="timer"` not live, decorative icons hidden, forms with `aria-invalid` + `aria-describedby`.
Open (low): the mobile menu has no focus trap and Escape does not return focus to its button; the header `<nav>` is
labelled with the site name rather than "Main"; the lightbox closes on a click on the photo itself (easy to trigger by
accident on touch).

### API design problems (server)

- Two login systems (`/auth/login` shared password, `/admin/login` user + password) and two sets of product admin routes
  (`/product/addProduct|updateProduct|deleteProduct` and `/admin/products`). Pick one.
- Inconsistent verbs and shapes: `getAllOrders` / `get_all_contact_us` / `get_request`; `PUT set_request_done` vs
  `PATCH orderSent`; plain-text answers (`"Created"`, `"Success"`) next to JSON; 204 with a body; validation answers
  422 in some routes and 400 in others.
- `create_order` still accepts a request without `type` and trusts the browser's amount (`pricing.js` `case undefined`).
  It is logged as deprecated; remove it when the old `client/` is retired.
- `live_room_id` lives in process memory (lost on restart, wrong with two instances) and has no reader in `web/`.
- The API does not return the PayPal capture id to `newOrder` (S1).

## 3. Conventions now enforced (no new dependency)

`npm run lint` (ESLint, `web/eslint.config.mjs`), applies to `src/**`:

- **No visible text in JSX**: `JSXText`, `{'literal'}` children, and `alt`/`aria-label`/`title`/`placeholder`/... string
  attributes containing letters are errors; use `useTranslations` / `getTranslations`.
- **No anonymous default exports** (arrow, function expression, unnamed function or class).
- **Import order** (`import/order`): libraries, then `@/` modules, then relative files.

`npm test` (Vitest):

- `tests/unit/conventions.test.ts`: no hex colours, no `rgb()/hsl()`, no named typefaces, no physical `left`/`right`
  properties outside `tokens.css` (reports `file:line`).
- `tests/unit/i18n-usage.test.ts`: every key the code asks for exists; no new unused key; the legacy list stays honest.
  Static analysis helper in `tests/unit/helpers/i18nUsage.ts`.
- `tests/unit/shared.test.tsx`: the shared modules, the proxy matcher, `postJson`, image hosts vs `next.config.ts`.
- `tests/unit/legacy-redirects.test.ts`: old-site addresses vs `next.config.ts`.
- `server/__tests__/hardening.test.js`, `admin-login.test.js`, `paypal-token.test.js`.

## 4. Behaviour changes (only bug fixes)

B1 (bare paths now redirect to a language), B2, B3, B4, B5, B6, B7, B8, B9 (candle e-mail fields align like the checkout in
right-to-left), B10, S2-S8. Additive: Twitter card on every page, richer organisation JSON-LD (logo, e-mail, social links)
on the reviews and live pages, `/health` also reports `database`.

## 5. Requests outside this branch

1. **`sec/hardening`**: S1 (payment proof for `newOrder`), S9 (required env in production), S10, S11, S14.
   Server edits here are small and local (`orderRoute.js` limiter lines, `paypalService.js`, `authRoute.js`,
   `adminRoute.js`, `app.js` health, `index.js` shutdown): expect trivial conflicts only if that branch touches the same lines.
2. **`feat/shop-features`**: use `lib/seo.pageMetadata`, `lib/jsonld`, `ui/Notice`, `ui/Flame`, `lib/images.isOptimizable`
   instead of the shop's copies; `/en/shop/<unknown id>` answers **200** (it should be 404; seen in the production build);
   `components/shop/seo.ts` duplicates `serializeJsonLd`.
3. **Performance branch**: client message tree (section 2, i18n); ISR error caching.
4. **Owner**: broadcast schedule (B11); `NEXT_PUBLIC_*` variables on Netlify.
