# Security: how the site is protected

How to **report** a problem is in [SECURITY.md](../SECURITY.md) at the repository root. This page is for the people
who build and run the site: what we defend, against whom, what is in place, and what is still open.

## 1. What we protect

| Asset | Why it matters | Where it lives |
|---|---|---|
| Money: shop orders, candles, donations | a visitor paying less than the price, or an order without a payment, is a direct loss | PayPal, MongoDB (`order`) |
| Customers' personal data: name, address, phone, e-mail | privacy law, trust of pilgrims | MongoDB (`order`, `contact`, `candle`) |
| Admin access | read every order, delete products, publish anything | JWT signed with `JWT_SECRET`, `ADMIN_PASSWORD`, `Admin` accounts |
| Secrets: PayPal secret, DB URL, JWT secret, Gmail app password | full takeover of the above | Render environment only, never in the repository |
| The site's reputation | a defaced page or a spam wall on a place of pilgrimage | the public site, reviews, prayers |

## 2. Who we defend against (threat model)

| Threat | Example | Main defences |
|---|---|---|
| A visitor tampers with prices | send `amount: 0.01`, or `totalPrice: 0.01` in an order | the API computes every price from the database; PayPal order is checked against that price (section 5) |
| An order without a payment | call `/order/newOrder` directly | `paypalOrderId` verified with PayPal; one payment pays for one order; `REQUIRE_PAYMENT_PROOF` |
| Cross-site scripting (XSS) | a review containing `<script>`, a poisoned product name | React escapes text; no raw HTML except JSON-LD through one escaping function; nonce-based CSP; API strips tags |
| Injection into the database | `{"username": {"$ne": null}}` | `express-mongo-sanitize`, type checks on every field, Mongoose `sanitizeFilter` + `strictQuery` |
| Guessing the admin password | scripted login attempts | 5 failed attempts per 15 minutes per IP, timing-safe comparison, long random `JWT_SECRET` checked at start |
| Forged or stolen admin token | `alg: none`, old token, token from another system | HS256 pinned, `maxAge` 8 h, role required, `Cache-Control: no-store` on admin answers |
| Abuse of public endpoints | like-botting, form spam, hammering PayPal calls | per-IP rate limits (section 4) and a 10 KB body limit |
| Mail relay | the candle form mailing a list of strangers | one strictly validated address per request, rate limited |
| Clickjacking, content sniffing, leaking referrers | the site framed by another page | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy` |
| A leaked secret | `.env` committed by mistake | gitleaks in CI on every pull request, build-output scan, `.gitignore` |
| A vulnerable dependency | a published CVE in Express or Mongoose | `npm audit` in CI (production dependencies, high and above), Dependabot |

Not in the model: a compromised Render/Netlify/MongoDB/PayPal account (protect those with two-factor sign-in), a
malicious team member, and denial of service at network level (Netlify and Render absorb some of it).

## 3. The website (`web/`)

### 3.1 Content-Security-Policy

`src/proxy.ts` gives **every page response its own nonce** and a policy built by `src/lib/csp.ts`:

- `script-src 'self' 'nonce-…' 'strict-dynamic'`: only scripts that carry the nonce run, and the scripts they load
  (the PayPal SDK) inherit the trust. **No `unsafe-inline`, no `unsafe-eval`** in production. Injected markup such
  as `<script>…</script>` or `onerror="…"` is refused by the browser even if it got into the page. The only inline
  script the site writes itself is the accessibility pre-paint script in the `<head>` (`web/src/lib/a11y.ts`,
  `A11Y_PREPAINT`): a constant with no visitor data that carries the nonce like Next's own scripts and only reads
  `localStorage` and sets `data-a11y-*` attributes on `<html>` (`tests/e2e/a11y.spec.ts` checks the nonce).
- `style-src 'self' 'nonce-…'`, plus `style-src-attr 'unsafe-inline'`: style *elements* need the nonce; inline
  `style=""` attributes (CSS variables written by React) cannot carry one and cannot run code.
- `connect-src`: our own origin, the API (`NEXT_PUBLIC_API_URL`) and PayPal. `frame-src` and `img-src`: PayPal.
  `frame-src` also allows `https://*.cloudflarestream.com`: Cloudflare Stream's player of a live broadcast and of a
  published recording on `/live` ([LIVE.md](LIVE.md)); the page frames only an address of the exact shape
  `https://customer-<code>.cloudflarestream.com/<32 hex>/iframe`. `img-src` also allows `https://*.cloudflarestream.com`
  for the poster pictures of published recordings (`https://customer-<code>.cloudflarestream.com/<32 hex>/thumbnails/thumbnail.jpg`,
  the only shape the page shows). `img-src`/`media-src`: Firebase Storage (product photos, videos). `font-src 'self'`: fonts are self-hosted.
- **The dashboard** (`admin/src/proxy.ts`, `admin/src/lib/csp.ts`) has its own strict policy (no `frame-src` beyond `'self'`,
  `media-src 'none'`). Only its Live page (`/live`) adds: `connect-src https://*.cloudflarestream.com` (the WHIP publish
  address) and exactly `https://upload.videodelivery.net https://upload.cloudflarestream.com` (the one-time tus upload
  addresses of recordings, Cloudflare's two upload hosts; the API refuses an upload address on any other host,
  `UPLOAD_HOSTS` in `server/services/cloudflareStream.js`), `frame-src https://*.cloudflarestream.com` (the preview player
  of a recording) and `img-src https://*.cloudflarestream.com` (the thumbnails). Every other dashboard page keeps the
  plain policy. If Cloudflare ever answers with another upload host, the API says "Cloudflare sent an upload address on
  an unexpected host (<host>)" in its log and the upload is refused: add the host to both lists, deliberately.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- `upgrade-insecure-requests` is added only for real https hosts (not on `localhost`, so development and the
  end-to-end tests keep working).
- Development (`next dev`) additionally allows `unsafe-eval`, inline styles and the hot-reload websocket.

Other headers (`next.config.ts`): `Cross-Origin-Opener-Policy: same-origin-allow-popups` (PayPal opens a popup),
`Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy` with every sensor and device API off (payment is
allowed for PayPal only; full screen, picture-in-picture and autoplay also for Cloudflare Stream's live player frame), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
`Referrer-Policy: strict-origin-when-cross-origin`. No `Cross-Origin-Embedder-Policy`: it would block PayPal and the
Firebase videos.

**The price of nonces:** a nonce differs for every response, so pages cannot be pre-rendered or cached at the CDN;
the locale layout reads the request headers and every page is rendered per request (`ƒ` in the build output).
`tests/e2e/security.spec.ts` checks the header on every response, that the nonce changes, that all scripts carry
it, and that no page raises a policy violation. If speed ever matters more than the strictness of the script
policy, the alternative is Next's experimental hash-based CSP (`experimental.sri`), which keeps pages static; it is
not used because it is experimental.

Adding a third-party service (analytics, a map, a chat widget) means adding its hosts to `src/lib/csp.ts` and a
line to its test, not loosening the policy.

### 3.2 Cross-site scripting

- The only `dangerouslySetInnerHTML` in the app writes JSON-LD (`<script type="application/ld+json">`). Every one
  goes through `src/lib/jsonLd.ts`, which writes `<`, `>`, `&`, U+2028 and U+2029 as `\uXXXX` escapes, so no text (a
  review, a product name) can close the tag; `tests/unit/security.test.ts` fails if a new use bypasses it.
- Everything else is rendered as React text. The same test forbids `eval`, `document.write`, `innerHTML =`, a
  `target="_blank"` link without `rel="noopener noreferrer"`, and any server-side environment variable in client
  code.
- Visitor text (reviews, prayers) is stored HTML-escaped by the API (`&` becomes `&amp;`); `src/lib/plainText.ts`
  decodes the five basic entities once, only for values that are rendered as text.
- Links to other sites are constants in the code (social profiles, Google Maps); none is built from user input.
- Open redirects: no `redirect()` takes user input; the language redirect only ever produces a path on this site
  (tested with `//evil.com`, `/\evil.com`, `/%5Cevil.com`).
- Browser storage: `localStorage` holds the cart (`nhc.cart.v1`), wishlist, recently viewed, the lit candles and the
  accessibility settings (`nhc.a11y.v1`: text size and on/off switches, validated on read). No credential, token or
  personal data, and no cookie except `NEXT_LOCALE` (the chosen language). The cart is
  validated when read (24-hex id, text fields, bounded quantity) because anything on the origin can edit it; the
  API validates everything again.
- No secret reaches the browser: only `NEXT_PUBLIC_*` variables are read; the PayPal client id is public by design.
  `npm run scan:bundle` (also in CI after the build) searches `.next` for the API's secret names and for credential
  shapes.

### 3.3 Payments in the browser

The browser only says *what* is bought. The API creates the PayPal order for its own price, captures it, and the
shop checkout then sends the PayPal order id (`paypalOrderId`) with the order so the API can prove the payment
(section 5).

**A paid order is never lost (docs/DATABASE.md section 2).** The moment PayPal says COMPLETED, the browser writes the order (or candle
request) to `localStorage` (`nhc.pending-fulfilment.v1`) and removes it only when the API confirms it, retrying with a growing delay and on every later
visit (`web/src/lib/pendingFulfilment.ts`). That record holds the customer's name, address, phone and e-mail **in their own browser** for at most
30 days; it is read only by the site's own script (nothing else on the origin can read `localStorage`, and the CSP allows no foreign script), is
never sent anywhere but to the API's two save routes, and is deleted on success. The cost: on a shared computer a paid but unsaved order stays in that
browser until it is saved; it cannot be read by another site. The retry loop only calls `/order/newOrder` and `/candle/lightACandle` (the stored
path is checked against that list on every read).

## 4. The API (`server/`)

### 4.1 Authentication and authorization

**The result of running the dashboard against this API and attacking both (what held, what was fixed, what is open) is in [ADMIN-RUNBOOK.md](ADMIN-RUNBOOK.md) sections 8 and 9.**

**The admin dashboard (new) has its own accounts, roles, optional TOTP, revocable sessions and an audit log: see [ADMIN.md](ADMIN.md).** The two sign-ins below are **deprecated** and kept only until the old admin site is retired.

Two ways to sign in exist side by side; both end in the **same kind of token** and `requireAdmin` accepts either:

| | `POST /auth/login` | `POST /admin/login` |
|---|---|---|
| Body | `{ password }` | `{ username, password }` |
| Checked against | `ADMIN_PASSWORD` (environment), timing-safe | `Admin` document, bcrypt hash |
| Token claims | `role: admin`, `auth: shared-password` | `role: admin`, `auth: account`, `id`, `username` |
| Used by | the admin site's current sign-in | accounts created by the owners |

All code for both is in `server/services/adminAuth.js`. Tokens: HS256, signed with `JWT_SECRET`, valid 8 hours, a
few seconds of clock tolerance, rejected if older than 8 hours or without an issue time. Tokens issued before
`role` existed (account tokens with `id` and `username`) are still accepted until they expire. To retire one
mechanism later: stop the admin site calling it, delete its route and its test in `auth.test.js`; nothing else
depends on it.

The new dashboard's only public API routes are `POST /admin/auth/login`, `POST /admin/auth/forgot-password` (always
`202`, never says whether an address has an account) and `POST /admin/auth/reset-password` (a one-time, 30-minute
token from the e-mail; only its SHA-256 is stored): [ADMIN.md](ADMIN.md) 3.1 and 3.6. The reset page of the dashboard
removes the token from the address bar at once and sends no Referer.

Every route that reads private data or changes anything is behind `requireAdmin` (all of `/admin`, `/order` reads
and changes, `/candle` and `/contact` reads and changes, `/product` writes, `/prayer` and `/review` deletes,
`/admin/live/*`); `auth.test.js` calls each of them without a token and expects 401. (The old unauthenticated-readable
`/live` room routes were removed; live broadcasting is `/admin/live`, [LIVE.md](LIVE.md).)

At start-up the server refuses (production) the example secrets, or one value for both `JWT_SECRET` and
`ADMIN_PASSWORD`, and warns about a `JWT_SECRET` under 32 or an `ADMIN_PASSWORD` under 12 characters.
**Check on Render that `JWT_SECRET` is at least 32 random characters.**

### 4.2 Rate limits (per IP, 15-minute window, in memory)

| Endpoint | Limit | Notes |
|---|---|---|
| everything | 200 | global |
| `/auth/login`, `/admin/login` | 5 failures | one shared counter; successful logins do not count |
| contact, candle, prayer create, review add | 10 | one shared counter |
| `/order/create_order`, `/order/complete_order` | 30 | one shared counter (each is a PayPal call for us) |
| `/order/newOrder` | 10 | |
| `/prayer/like/:id` | 30 | |
| `/admin/*` (any address) | 1000 | per-address ceiling in front of the admin routes ([ADMIN.md](ADMIN.md) 3.1) |
| `GET /live/status` | 3000 | its own counter: every open `/live` page asks about every 15 seconds; answered from memory for 5 seconds ([LIVE.md](LIVE.md)) |
| `/admin/auth/login` | 5 failures per address + username, 30 per address | successful sign-ins and the TOTP prompt do not count |
| `/admin/auth/forgot-password` | 3 per address + e-mail, 10 per address | every request counts (each one can send a mail) |
| `/admin/auth/reset-password` | 10 failures | successful resets do not count |
| `/admin/*` signed in | 300 | per admin account, not per address |
| `/admin/auth/password`, `totp/enable`, `totp/disable` | 5 failures | per admin account |

The counters live in the server's memory: correct for the single Render instance, **not shared** if the service is
ever scaled to several instances (then use a shared store such as Redis). Behind NAT (a tour group on one Wi-Fi)
visitors share a budget.

### 4.3 Input and queries

- Request bodies are limited to 10 KB; strings are type-checked before use (an object or array where text is
  expected is refused); e-mail addresses must be a single plain mailbox (no lists, quotes, comments, angle
  brackets or line breaks), because they are handed to the mailer.
- `express-mongo-sanitize` strips `$`-keys and dotted keys from body, query, params and headers (tested through
  HTTP, not just by reading the library). It runs **before** `express-xss-sanitizer` (version 2 makes `req.query`
  read-only, and the order matters).
- Mongoose runs with `sanitizeFilter` (an operator used as a value becomes an equality match) and `strictQuery`
  (unknown filter fields are dropped); the one query that needs `$in` marks it `mongoose.trusted`.
- Mass assignment: routes copy named fields only (`approved`, `likes`, `done`, `paymentVerified`, `_id`, dates are
  never taken from a body).
- Pagination is bounded (`size` at most 50 or 100, `page` at least 1).

### 4.4 Transport, errors and logs

- `helmet` configured for a JSON API (`default-src 'none'`, `frame-ancestors 'none'`, no referrer, HSTS two years).
- CORS allows only our own sites; local development origins are **not** trusted in production (use `EXTRA_ORIGINS`
  to add one deliberately). The preflight answer is cached for 10 minutes.
- In production a server error answers `Internal server error` and nothing else (no stack, no PayPal text, no
  database text); bad ids answer `Invalid id`; a duplicate key answers 409.
- Logs: failed sign-ins are logged with the IP and a JSON-quoted, shortened username (no line breaks, so a log line
  cannot be forged); passwords, tokens and PayPal credentials are never logged. Request logging is off in production.

## 5. Order and payment integrity

```
browser                         API                                PayPal
  | create_order {type,items}    |                                    |
  |----------------------------->| price = database prices            |
  |                              |--- create order (price) ---------->|
  | approve in the PayPal popup  |                                    |
  | complete_order {order_id}    |                                    |
  |----------------------------->|--- capture ----------------------->|
  | newOrder {…, paypalOrderId}  |                                    |
  |----------------------------->| price again from the database      |
  |                              |--- GET order --------------------->|
  |                              |  COMPLETED? one purchase? USD?     |
  |                              |  amount == price? capture COMPLETED|
  |                              | already used by another order? -> 409
  |                              | save order (paymentVerified: true) |
```

- `paypalOrderId` is **optional for now**, so the old CRA site (which does not send it) keeps working. When it is
  missing the order is saved as `paymentVerified: false` and the log gets a line containing `[unverified-order]`.
  Search the Render logs for it to see how many orders still arrive unproven.
- When it is sent, the order is saved only if PayPal itself says: `COMPLETED`, exactly one purchase, USD, an amount
  equal to the price the API computes now, and a `COMPLETED` capture for at least that amount. Otherwise 402 and
  nothing is saved. If PayPal cannot be asked the answer is 502 and nothing is saved (fail closed; the browser's
  retry button asks again).
- One PayPal order can pay for one shop order: checked before saving, and enforced by a partial unique index on
  `order.paypalOrderId` (two simultaneous requests: the second gets 409).
- If a product price changes between payment and saving, the amounts differ and the order is refused with 402; the
  Render log names the PayPal order id so the payment can be reconciled by hand.
- **To make it mandatory:** set `REQUIRE_PAYMENT_PROOF=true` on Render once the old site is retired.
- **The payment ledger** (`payment` collection, `server/services/payments.js`): `create_order` writes a row *before* the PayPal id reaches the browser
  (if it cannot, 503: nothing is charged); `complete_order` marks it captured, **idempotently** (a repeat never captures or records twice; PayPal's
  "already captured" is checked and accepted; a declined card is a definite 402); `newOrder` and `lightACandle` accept the optional `paypalOrderId`, require the
  ledger's type to match (**a donation or a candle payment cannot pay for an order**, which closes a hole: a $23 donation could have been presented as the
  $23 order total), and link the row. A candle (3 USD) is checked the same way (the ledger says captured, else PayPal is asked for exactly 3 USD), and one payment lights one
  candle (partial unique index). A donation's only record is its ledger row (with the optional donor name). `REQUIRE_PAYMENT_PROOF=true` now covers candles too.
- A payment the browser never saved is **listed**, not lost: the dashboard's Payments screen ("Paid, not fulfilled", a warning on the dashboard) and
  `scripts/reconcile-payments.js`. Rows are never deleted through the API; only marked resolved, with a note, and audited.

## 6. Repository and delivery

- `.github/workflows/security.yml`: **gitleaks** (official container image, version pinned) over the whole git
  history and tree on every pull request and push, plus a weekly run; `npm audit --omit=dev --audit-level=high` for
  `server/` and `web/`. Allow-list and the reasons: `.gitleaks.toml`.
- `.github/workflows/ci.yml`: also runs `npm run scan:bundle` after the web build.
- A manual scan of the history (72 commits, all branches) for private keys, connection strings, `.env`-style
  assignments, PayPal/Google/GitHub/Slack/AWS/Stripe tokens, JWTs and credentials in URLs found only the
  placeholders in `server/.env.example`; no `.env`, key or certificate file was ever committed. (The PayPal
  *sandbox client id* and Firebase Storage download tokens appear in the code; both are public by design.)
- Dependabot keeps dependencies current. Last audit (production dependencies): 0 known vulnerabilities in `web/` and
  `server/`. Remaining advisories are development-only: `braces` (through `nodemon` in `server/`, `eslint-config-next`
  in `web/`), for which no patched version exists.
- Secrets live only in Render and Netlify settings. If a secret was ever pasted into a chat, an e-mail or a ticket,
  treat it as leaked and rotate it (Render env, then redeploy).

## 7. Open items and accepted risks

| Item | Risk | Plan |
|---|---|---|
| `/order/newOrder` accepts orders without proof of payment | an attacker can create unpaid orders (the owners would see `paymentVerified: false`) | set `REQUIRE_PAYMENT_PROOF=true` when the old site is retired |
| No PayPal webhook | a payment whose capture answer was lost *and* whose ledger write also failed stays `created` while PayPal holds the money (the ledger and the browser retry cover the normal cases) | PayPal Live phase: webhook with signature verification fills the ledger from PayPal itself; until then `reconcile-payments.js` lists `created` rows older than 24 h and PayPal's dashboard is the truth |
| The paid-but-unsaved order sits in the customer's `localStorage` | personal data in a shared browser until it is saved (at most 30 days) | deleted on success; the privacy page should say so (not yet written, docs/TODO-LEGAL.md) |
| Backups (docs/BACKUP.md) contain all personal data and the admin hashes | a stolen backup folder | keep it private (BitLocker), use a read-only database user, 30-day rotation; never in the repository |
| The production server no longer builds indexes at start-up | a release that needs a new index (the `payment` unique one) does nothing useful until `ensure-indexes.js --apply` is run | run it before deploying (docs/DATABASE.md section 10); the server logs a warning for any missing index |
| Reviews and prayers are public immediately (`approved` defaults to true) | spam or abuse appears until an admin deletes it | add moderation (`approved: false` by default and an admin queue) |
| The candle form mails an address typed by a stranger | it can send one "we received your request" mail per request (rate limited) | verify the address, or send the video link only after payment |
| Rate-limit counters are per process | not shared between instances | shared store when scaling out |
| CSP has no report endpoint | violations in visitors' browsers are invisible | add `report-to` with an error tracker (Sentry) |
| `style-src-attr 'unsafe-inline'` | inline style attributes cannot be nonce-protected | remove when no component writes `style=""` |
| The old shared-password / account sign-ins (`/auth/login`, `/admin/login`) | one shared secret, no roles, no lockout, no audit, 8-hour tokens that cannot be revoked | retire them when the old admin site is off (ADMIN.md section 7) |
| Behind the dashboard the API sees the dashboard host's address, not the visitor's (`trust proxy` 1, last `X-Forwarded-For` entry) | the per-address sign-in limits are shared by all visitors and audit address hashes are identical; anyone can lock an account for 15 minutes | the per-account lockout is the real control; a shared secret between dashboard and API would allow a safe visitor address (ADMIN-RUNBOOK.md 9) |
| **Behind Cloudflare the API counts the Cloudflare edge address, not the visitor** (measured 2026-10-06: eight requests from one PC were counted in at least three different per-IP buckets, and a forged `X-Forwarded-For` did not create a fresh one; the cause is inferred from that, not seen in the server) | every per-IP limit (5 failed logins, 10 contact forms, 30 payment calls, 200 requests) is shared by all visitors who reach Render through the same Cloudflare address: a spammer can use up the allowance of strangers, and the same address can lock the admin sign-in. Brute force is not made easier (a forged header does not help), but the limits protect less and annoy more than intended | `TRUST_PROXY_HOPS=2` on Render after the check in INFRASTRUCTURE.md 2.5 (code is in; default stays 1) |
| Live broadcasting: the WHIP publish address is a bearer secret | whoever holds it can broadcast on our page until the session ends (at most 6 hours) | given once, only to the admin who started the session, never stored or logged (tested); ending the session deletes the Cloudflare input, which kills the address ([LIVE.md](LIVE.md) section 3) |
| Live broadcasting: Cloudflare's player page is framed without a `sandbox` | the frame runs Cloudflare's scripts (a cross-origin frame: it cannot read our page; a top-level navigation needs the visitor's click) | only the exact `customer-<code>.cloudflarestream.com/<id>/iframe` shape is framed, `frame-src` allows only that host family; a sandbox was left out because the player could not be tested against a real account yet (revisit after the first real broadcast) |
| Live broadcasting: `CF_STREAM_API_TOKEN` | a leaked token can create and delete live inputs and videos (and cost money) | a custom token with Stream: Edit on one account only, Render only, rotate in Cloudflare if leaked |
| Recordings: the one-time tus upload address is a bearer secret | whoever holds it could upload a different file (up to the stated size and length) as that recording until the upload is done or the address expires (4 hours); the dashboard would then show that file as the recording | given once, only to the admin who asked (who started the broadcast, or an owner), never stored (not in the database, not in the browser's IndexedDB copy), never logged (tested), sent only to Cloudflare's upload hosts with no cookies or referrer; nothing is ever published by itself: an editor watches the preview before pressing Publish ([LIVE.md](LIVE.md) section 9) |
| Recordings: a ready but unpublished video can be played by anyone who knows its 32-hex id | the id is random and is shown only in the dashboard; it is not guessable | signed playback URLs (`requireSignedURLs`) would close it, at the cost of a token service; revisit if drafts ever hold something sensitive. Deleting a recording deletes the video at Cloudflare |
| Recordings: the browser keeps a copy of a recording in IndexedDB until it is uploaded | a recording on a shared or lost phone or computer | deleted after a successful upload or on "Discard"; the dashboard is staff-only and signed out after 30 idle minutes, but the IndexedDB copy stays on the device: staff record on their own devices |
| The website's "we are live now" window | a pop-up is a pattern the site otherwise refuses (DESIGN-GUIDE 1.5) | the owner asked for it; it is our own markup (no third-party script), once per broadcast, never on payment pages, and stores only a broadcast id in `localStorage` |
| Dashboard tokens cannot be refreshed (60 minutes) | an admin signs in again every hour | add a refresh route if that proves annoying |
| Admin site (separate repository) keeps its token in the browser | XSS on the admin site would expose it | review there; tokens already expire after 8 hours |
| Pages are rendered per request (nonce) | slower first byte than static pages | measure; consider hash-based CSP if needed |
| Stored visitor text is HTML-escaped by the API | consumers that print it raw would show `&amp;` | decode on display (done in `web/`); consider storing raw text and escaping on output only |
| `NEXT_LOCALE` cookie is not `Secure` | none (a language preference) | set `localeCookie.secure` if more cookies are ever added |
| Gitleaks configuration was written without being able to run gitleaks locally | the first CI run may need an allow-list entry | review the first run |
