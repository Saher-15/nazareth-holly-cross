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
  as `<script>…</script>` or `onerror="…"` is refused by the browser even if it got into the page.
- `style-src 'self' 'nonce-…'`, plus `style-src-attr 'unsafe-inline'`: style *elements* need the nonce; inline
  `style=""` attributes (CSS variables written by React) cannot carry one and cannot run code.
- `connect-src`: our own origin, the API (`NEXT_PUBLIC_API_URL`) and PayPal. `frame-src` and `img-src`: PayPal.
  `img-src`/`media-src`: Firebase Storage (product photos, videos). `font-src 'self'`: fonts are self-hosted.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- `upgrade-insecure-requests` is added only for real https hosts (not on `localhost`, so development and the
  end-to-end tests keep working).
- Development (`next dev`) additionally allows `unsafe-eval`, inline styles and the hot-reload websocket.

Other headers (`next.config.ts`): `Cross-Origin-Opener-Policy: same-origin-allow-popups` (PayPal opens a popup),
`Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy` with every sensor and device API off (payment is
allowed for PayPal only), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
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
- Browser storage: `localStorage` holds the cart (`nhc.cart.v1`), wishlist, recently viewed and the lit candles. No
  credential, token or personal data, and no cookie except `NEXT_LOCALE` (the chosen language). The cart is
  validated when read (24-hex id, text fields, bounded quantity) because anything on the origin can edit it; the
  API validates everything again.
- No secret reaches the browser: only `NEXT_PUBLIC_*` variables are read; the PayPal client id is public by design.
  `npm run scan:bundle` (also in CI after the build) searches `.next` for the API's secret names and for credential
  shapes.

### 3.3 Payments in the browser

The browser only says *what* is bought. The API creates the PayPal order for its own price, captures it, and the
shop checkout then sends the PayPal order id (`paypalOrderId`) with the order so the API can prove the payment
(section 5).

## 4. The API (`server/`)

### 4.1 Authentication and authorization

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

Every route that reads private data or changes anything is behind `requireAdmin` (all of `/admin`, `/order` reads
and changes, `/candle` and `/contact` reads and changes, `/product` writes, `/prayer` and `/review` deletes,
`/live` writes); `auth.test.js` calls each of them without a token and expects 401.

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
- A candle (3 USD) and a donation have no order record; their only server-side effect is the PayPal charge, and the
  candle e-mail is sent by the candle form, not by the payment.

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
| No PayPal webhook | a paid order whose browser closed before `newOrder` has no record | PayPal Live phase: webhook with signature verification |
| Reviews and prayers are public immediately (`approved` defaults to true) | spam or abuse appears until an admin deletes it | add moderation (`approved: false` by default and an admin queue) |
| The candle form mails an address typed by a stranger | it can send one "we received your request" mail per request (rate limited) | verify the address, or send the video link only after payment |
| Rate-limit counters are per process | not shared between instances | shared store when scaling out |
| CSP has no report endpoint | violations in visitors' browsers are invisible | add `report-to` with an error tracker (Sentry) |
| `style-src-attr 'unsafe-inline'` | inline style attributes cannot be nonce-protected | remove when no component writes `style=""` |
| Admin site (separate repository) keeps its token in the browser | XSS on the admin site would expose it | review there; tokens already expire after 8 hours |
| Pages are rendered per request (nonce) | slower first byte than static pages | measure; consider hash-based CSP if needed |
| Stored visitor text is HTML-escaped by the API | consumers that print it raw would show `&amp;` | decode on display (done in `web/`); consider storing raw text and escaping on output only |
| `NEXT_LOCALE` cookie is not `Secure` | none (a language preference) | set `localeCookie.secure` if more cookies are ever added |
| Gitleaks configuration was written without being able to run gitleaks locally | the first CI run may need an allow-list entry | review the first run |
