# Security: how the site is protected

How to **report** a problem is in [SECURITY.md](../SECURITY.md) at the repository root. This page is for the people
who build and run the site: what we defend, against whom, what is in place, and what is still open.

## 1. What we protect

| Asset | Why it matters | Where it lives |
|---|---|---|
| Money: shop orders, candles, donations | a visitor paying less than the price, or an order without a payment, is a direct loss | PayPal, MongoDB (`order`) |
| Customers' personal data: name, address, phone, e-mail | privacy law, trust of pilgrims | MongoDB (`order`, `contact`, `candle`) |
| Admin access | read every order, delete products, publish anything | `Admin` accounts with roles, optional TOTP and revocable sessions; session tokens signed with `JWT_SECRET` |
| Secrets: PayPal secret, DB URL, JWT secret, Gmail app password | full takeover of the above | Render environment only, never in the repository |
| The site's reputation | a defaced page or a spam wall on a place of pilgrimage | the public site, reviews, prayers |

## 2. Who we defend against (threat model)

| Threat | Example | Main defences |
|---|---|---|
| A visitor tampers with prices | send `amount: 0.01`, or `totalPrice: 0.01` in an order | the API computes every price from the database; PayPal order is checked against that price (section 5) |
| An order without a payment | call `/order/newOrder` directly | `paypalOrderId` verified with PayPal; one payment pays for one order; `REQUIRE_PAYMENT_PROOF` |
| Cross-site scripting (XSS) | a review containing `<script>`, a poisoned product name | React escapes text; no raw HTML except JSON-LD through one escaping function; nonce-based CSP; API strips tags |
| Injection into the database | `{"username": {"$ne": null}}` | `express-mongo-sanitize`, type checks on every field, Mongoose `sanitizeFilter` + `strictQuery` |
| Guessing the admin password | scripted login attempts | 5 failures per address + username and 30 per address per 15 minutes, account lockout, constant work for unknown users, long random `JWT_SECRET` checked at start |
| Forged or stolen admin token | `alg: none`, old token, token from another system | HS256 pinned, only session tokens (60 minutes, a live server-side session, the role read from the database), `Cache-Control: no-store` on admin answers |
| Abuse of public endpoints | like-botting, form spam, hammering PayPal calls | per-IP rate limits (section 4) and a 10 KB body limit |
| Mail relay and content injection | the candle form mailing strangers a "refund" link from the church's Gmail | one strictly validated address per request, rate limited; a confirmation only for a PayPal-verified payment; plain text with no visitor text but a checked greeting name (`services/mailText.js`) |
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
- Browser storage: `localStorage` holds the cart (`nhc.cart.v1`), wishlist, recently viewed, the lit candles, the
  accessibility settings (`nhc.a11y.v1`: text size and on/off switches, validated on read) and the broadcasts the
  "we are live now" window was shown for (`nhc.liveAlert.v1`: at most 20 session ids, validated on read). No credential, token or
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

**Payment recovery (docs/DATABASE.md section 2).** Before capture, the browser saves the approved PayPal order id and original form
to `localStorage` (`nhc.pending-fulfilment.v1`). Storage failure prevents capture. Unknown outcomes stay unconfirmed; a returning browser
checks the original capture before fulfilling the order/candle. Records are removed after confirmation and expire after 30 days.
They contain personal delivery/prayer details on the customer's device; any script executing on the same origin can read them,
including permitted third-party scripts. Other origins cannot read them. Keep the CSP restrictive and consider shared-device privacy.
The retry engine allows only `/order/complete_order`, `/order/newOrder` and `/candle/lightACandle`.

## 4. The API (`server/`)

### 4.1 Authentication and authorization

**The result of running the dashboard against this API and attacking both (what held, what was fixed, what is open) is in [ADMIN-RUNBOOK.md](ADMIN-RUNBOOK.md) sections 8 and 9.**

**The admin dashboard has its own accounts, roles, optional TOTP, revocable sessions and an audit log: see [ADMIN.md](ADMIN.md).** It is the **only** way into private data.

The two legacy sign-ins (`POST /auth/login` with the shared `ADMIN_PASSWORD`, `POST /admin/login` with an account's
password) and the `requireAdmin` middleware were **removed on 2026-10-07** (security review 06, finding 1): they gave an
8-hour token with no session, no second factor, no role, no lockout, no revocation and no audit entry, to any account's
password (a viewer's, a disabled or locked one, one with TOTP on). Every route that accepted those tokens was removed too
(the list is in [ADMIN.md](ADMIN.md) section 7): the removed addresses answer `404`, and the dashboard routes accept only a
**session token** (`services/adminSessions.js` `verifySessionToken`: `{ sub, sid, role }`, HS256, at most 60 minutes, a
live session in the database, the account still enabled), so a legacy token issued before the change opens nothing.
`JWT_SECRET` was not rotated: it also keys the TOTP encryption and the audit address hash (`services/keys.js`).
`server/__tests__/auth.test.js` proves both sign-ins are gone, every old route is gone, and three kinds of legacy token
are refused on every dashboard route.

The dashboard's only public API routes are `POST /admin/auth/login`, `POST /admin/auth/forgot-password` (always
`202`, never says whether an address has an account) and `POST /admin/auth/reset-password` (a one-time, 30-minute
token from the e-mail; only its SHA-256 is stored): [ADMIN.md](ADMIN.md) 3.1 and 3.6. The reset page of the dashboard
removes the token from the address bar at once and sends no Referer. Setting up two-factor sign-in
(`POST /admin/auth/totp/setup`) asks for the current password again, like changing the password and turning TOTP off
(security review 06, finding 9).

**After sign-in** the dashboard goes to the `next` page only if it is a path on the dashboard itself
(`admin/src/lib/session.ts` `safeNextPath`): one leading `/`, no backslash, control character, whitespace or invisible
character anywhere (also once percent-decoded), the same origin when resolved, and still one leading `/` after the URL
parser normalised it; the normalised path is what the browser gets (security review 06, finding 4: `/\t/evil.example`
used to pass, and browsers drop the tab).

Every route that reads private data or changes anything is under `/admin` behind `adminAccess` and a role check
(`auth.test.js` calls each of them without a token and expects 401). The public routes (`/order/create_order`,
`complete_order`, `newOrder`, `/candle/lightACandle`, `/contact/contact_us_request`, `/prayer/create|like`,
`/review/addReview`, the product and live reads) take no token. (The old unauthenticated-readable `/live` room routes
were removed; live broadcasting is `/admin/live`, [LIVE.md](LIVE.md).)

At start-up the server refuses (production) the example `JWT_SECRET` and warns about one under 32 characters.
`ADMIN_PASSWORD` is no longer required or read; a leftover value only logs a warning to delete it.
**Check on Render that `JWT_SECRET` is at least 32 random characters, and delete `ADMIN_PASSWORD` there.**

### 4.2 Rate limits (per IP, 15-minute window, in memory)

| Endpoint | Limit | Notes |
|---|---|---|
| everything | 200 | global |
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
| `/admin/auth/password`, `totp/setup`, `totp/enable`, `totp/disable` | 5 failures | per admin account |

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
- CORS allows only our own sites: `https://nazarethholycross.com`, `www`, the site's Netlify address, **exactly** this
  site's deploy previews (`https://deploy-preview-<digits>--nazarethholycross.netlify.app`), `CLIENT_URL`, `ADMIN_ORIGINS`
  and `EXTRA_ORIGINS`. Branch deploys (`<anything>--nazarethholycross.netlify.app`) and the retired 2024 admin site
  (`nazaretholycrossadmin`) are no longer trusted (security review 06, finding 10; `cors.test.js`). Local development
  origins are **not** trusted in production (use `EXTRA_ORIGINS` to add one deliberately). The preflight answer is cached
  for 10 minutes. Netlify should also not build deploy previews of pull requests from forks (owner setting).
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

- `paypalOrderId` is **required by default and always required in production**. The public site (`web/`) **always**
  sends it: the only callers of `/order/newOrder` and `/candle/lightACandle` are the pending-fulfilment engine
  (`web/src/lib/pendingFulfilment.ts`), which adds the PayPal order id to every attempt and refuses a stored record
  without one, and has done so since before the site went live. A **donation** has no fulfilment request at all: the
  payment is its own record (`create_order` with `type: 'donation'`, then `complete_order` with the PayPal id), so there is
  no unpaid donation route to close. The old CRA site that did not send it is retired. Only explicitly opted-out local fixtures can be
  saved as `paymentVerified: false`; the log then contains `[unverified-order]` (`[unverified-candle]`), and
  **no confirmation mail is sent** (only a verified payment is confirmed by mail: security review 06, finding 5).
- When it is sent, the order is saved only if PayPal itself says: `COMPLETED`, exactly one purchase, USD, an amount
  equal to the approved immutable server quote (or current price for historical payments without a quote), and only completed captures totalling exactly that amount. Otherwise 402 and
  nothing is saved. If PayPal cannot be asked the answer is 502 and nothing is saved (fail closed; the browser's
  retry button asks again).
- One PayPal order can pay for one shop order: checked before saving, and enforced by a partial unique index on
  `order.paypalOrderId` (two simultaneous requests: the second gets 409).
- Shop payments store an immutable server quote (amount, product ids, names, quantities and colours). Fulfilment uses that quote even after catalog changes, and refuses changed items. Older payments without a snapshot require manual reconciliation if prices changed.
- Payment proof is mandatory by default and always mandatory when `NODE_ENV=production`; `REQUIRE_PAYMENT_PROOF=false` only permits unpaid local/test fixtures.
- **The payment ledger** (`payment` collection, `server/services/payments.js`): `create_order` writes a row *before* the PayPal id reaches the browser
  (if it cannot, 503: nothing is charged); `complete_order` marks it captured, **idempotently** (a repeat never captures or records twice; PayPal's
  "already captured" is checked and accepted; a pending nested capture returns 202 and remains unverified); `newOrder` and `lightACandle` require `paypalOrderId` in production, require the
  ledger's type to match (**a donation or a candle payment cannot pay for an order**, which closes a hole: a $23 donation could have been presented as the
  $23 order total), and link the row. A candle (3 USD) is checked the same way (the ledger says captured, else PayPal is asked for exactly 3 USD), and one payment lights one
  candle (partial unique index). A donation's only record is its ledger row (with the optional donor name). `REQUIRE_PAYMENT_PROOF=true` now covers candles too.
- A payment the browser never saved is **listed**, not lost: the dashboard's Payments screen ("Paid, not fulfilled", a warning on the dashboard) and
  `scripts/reconcile-payments.js`. Rows are never deleted through the API; only marked resolved, with a note, and audited.

## 6. Repository and delivery

- `.github/workflows/security.yml`: **gitleaks** (official container image, version pinned) over the whole git
  history and tree on every pull request and push, plus a weekly run; `npm run security:audit` for `server/`, `web/` and `admin/`, including development dependencies. The only exception is the tested, development-only braces advisory described below, with a hard expiry. Allow-list and the reasons: `.gitleaks.toml`.
- `.github/workflows/ci.yml`: also runs `npm run scan:bundle` after the web build.
- A manual scan of the history (72 commits, all branches) for private keys, connection strings, `.env`-style
  assignments, PayPal/Google/GitHub/Slack/AWS/Stripe tokens, JWTs and credentials in URLs found only the
  placeholders in `server/.env.example`; no `.env`, key or certificate file was ever committed. (The PayPal
  *sandbox client id* and Firebase Storage download tokens appear in the code; both are public by design.)
- Dependabot keeps dependencies current. Production dependency audits report no known vulnerabilities in all three projects. `nodemon` has been removed in favour of native `node --watch`. Next.js lint tooling still depends on `braces@3.0.3` (GHSA-vfj7-8cjw-p6xm), with no upstream fix. ESLint preloads `ops/braces-depth-guard.cjs` to reject pattern/AST nesting above 64 before recursive walkers. The full audit gate tests all five guarded APIs against 10,000-level inputs and an ordinary glob, requires every affected lock entry to be development-only, permits only this exact advisory and fails from 2026-11-06. Raw npm audit continues to report the upstream advisory; this is a temporary mitigation, not an upstream patch.
- Secrets live only in Render and Netlify settings. If a secret was ever pasted into a chat, an e-mail or a ticket,
  treat it as leaked and rotate it (Render env, then redeploy).

## 7. Open items and accepted risks

| Item | Risk | Plan |
|---|---|---|
| No PayPal webhook | server repair is an operator-run batch rather than an automatic provider notification | `node scripts/repair-payments.js` compares unresolved rows with PayPal read-only; `--apply` repairs verified completed captures and saved drafts without capturing or charging. Schedule/run it after deployment with operator credentials. Unknown provider outcomes remain unresolved; never mark them paid. |
| The approved payment and pending order sit in the customer's `localStorage` | personal data in a shared browser until it is saved (at most 30 days) | deleted on success; the privacy page should say so (not yet written, docs/TODO-LEGAL.md) |
| Backups (docs/BACKUP.md) contain all personal data and the admin hashes | a stolen backup folder | keep it private (BitLocker), use a read-only database user, 30-day rotation; never in the repository |
| The production server no longer builds indexes at start-up | a release that needs a new index (the `payment` unique one) does nothing useful until `ensure-indexes.js --apply` is run | run it before deploying (docs/DATABASE.md section 10); the server logs a warning for any missing index |
| Reviews and prayers are public immediately (`approved` defaults to true) | spam or abuse appears until an admin deletes it | add moderation (`approved: false` by default and an admin queue) |
| The candle and order confirmations go to an address the customer typed | a paying customer could make the church's Gmail write to someone else (at $3 a mail; the text is fixed and carries no visitor text but a checked greeting name) | acceptable; unpaid requests send nothing |
| Rate-limit counters are per process | not shared between instances | shared store when scaling out |
| CSP has no report endpoint | violations in visitors' browsers are invisible | add `report-to` with an error tracker (Sentry) |
| `style-src-attr 'unsafe-inline'` | inline style attributes cannot be nonce-protected | remove when no component writes `style=""` |
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
| The retired 2024 admin site (`nazaretholycrossadmin.netlify.app`) still serves its old page | it points at a deleted Heroku app; if someone registered that name, the page would talk to them | unpublish it or redirect it to the dashboard (owner, Netlify); the API no longer trusts its origin and its routes are gone |
| Pages are rendered per request (nonce) | slower first byte than static pages | measure; consider hash-based CSP if needed |
| Stored visitor text is HTML-escaped by the API | consumers that print it raw would show `&amp;` | decode on display (done in `web/`); consider storing raw text and escaping on output only |
| `NEXT_LOCALE` cookie is not `Secure` | none (a language preference) | set `localeCookie.secure` if more cookies are ever added |
| Gitleaks configuration was written without being able to run gitleaks locally | the first CI run may need an allow-list entry | review the first run |

## Audit fixes (2026-10-07)

TOTP login consumes the accepted time step with a conditional atomic database update; parallel requests cannot both create a session. Legacy sign-in remains removed. Capture success requires completed nested captures for exactly the ledger amount in USD; pending captures return 202 PENDING and remain unverified. Historical captured rows without `captureVerified` are rechecked with PayPal before reuse.

The browser saves the payment id and original approved form before the first capture request. Storage failure blocks capture; uncertain answers stay unconfirmed and block a new payment of that kind. A returning browser confirms the original payment before fulfilling it. The API also stores a validated draft before exposing the PayPal id, fulfils it after a verified capture, and removes the draft after linking or privacy erasure. Drafts are hidden from ordinary reads. Repair batches exclude verified donations without drafts and rotate by last-check time. Voided payments with no captures can have drafts cleared after 30 days; unknown/paid drafts remain for recovery or owner erasure. The repair script must be run/scheduled by the operator; these changes do not attest to production deployment.
