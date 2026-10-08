# The admin dashboard API

The API behind the new admin dashboard (`server/route/admin/*`). It replaces the single shared admin password with
personal accounts, roles, optional two-factor sign-in, sessions that can be ended at once, and an audit log.
Threat model and the rest of the API's protections: [SECURITY.md](SECURITY.md) (section 4.1).

Everything below is under the API origin (Render: `https://nazareth-holy-cross-api-production.up.railway.app`). Bodies are JSON.
Every error is `{ "error": "text" }`; every answer under `/admin` carries `Cache-Control: no-store`.

## 1. Setting it up

### 1.1 The first owner

Accounts are created by an owner in the dashboard (`POST /admin/users`). The first owner is created one of two ways.

**Recommended: by e-mail, from the dashboard's "Forgot your password?" page.** While the database holds **no admin
account at all**, a password-reset request (section 3.6) for an address listed in `ADMIN_BOOTSTRAP_EMAILS` (default
`nazarethholycross@gmail.com`) creates an **owner** whose username is that address and whose password is random and
unknown to anyone, and mails that address the one-time link to choose the password. Only the person who can read that
mailbox can finish. As soon as one account exists, the address is treated like any other (no account is ever created
again this way). Steps: [ADMIN-RUNBOOK.md](ADMIN-RUNBOOK.md) section 2.

**Fallback: from a terminal**, when mail does not work or for another username:

```bash
cd server
node scripts/create-admin.js      # or: npm run create-admin
```

It prints the database host (check it is the one you mean), asks for a username and a password (typed twice, hidden)
and creates an **owner**. Credentials are never accepted from arguments or environment variables, and the script
refuses to run without an interactive terminal. A weak password is refused (three tries). To run it against
production, put the production `DATABASEURL` in a local `server/.env` for the moment (never commit it), run the
script, and remove it.

Existing documents in the `Admin` collection keep working: an account with none of the new fields is an **enabled
owner** with no second factor. Their passwords (bcrypt cost 10) still verify; any password set from now on uses
cost 12.

### 1.2 Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `JWT_SECRET` | yes (already) | Signs the dashboard tokens, and (through HKDF, see 3.5) encrypts the TOTP secrets and keys the audit address hash. At least 32 random characters. **Rotating it signs everyone out and makes stored TOTP secrets unreadable** (section 6). |
| `ADMIN_ORIGINS` | **new**, for the dashboard | Comma-separated exact browser origins of the dashboard, e.g. `https://admin.nazarethholycross.com`. Added to the CORS allow-list. No wildcards; a trailing slash is ignored. The dashboard calls the API from its own server, so this matters only if a browser ever calls the API directly (the old admin site's `nazaretholycrossadmin.netlify.app` addresses are **no longer** trusted, 2026-10-07). |
| `DATABASEURL` | yes (already) | MongoDB. New collections: `adminSession`, `auditLog`. |
| `ADMIN_PASSWORD` | **no longer used** | The shared-password sign-in it served was removed on 2026-10-07 (section 7). The server neither requires nor reads it; a leftover value only logs "ADMIN_PASSWORD is set but no longer used". **The owner can delete it on Render** (Environment). |
| `ADMIN_APP_URL` | no | Where the dashboard lives; the password-reset e-mail links to `<ADMIN_APP_URL>/reset-password?token=...`. Default `https://admin.nazarethholycross.com`; set it when the dashboard moves to its own domain. A trailing slash is ignored. |
| `ADMIN_BOOTSTRAP_EMAILS` | no | Comma-separated addresses that may create the **first** owner by a password-reset request while no account exists (1.1). Default `nazarethholycross@gmail.com`; `ADMIN_BOOTSTRAP_EMAILS=` (empty) turns it off. |
| `MAIL_FROM`, `MAIL_APP_PASSWORD` | yes (already) | The reset e-mails go out through the same mailer as the order mails. |
| `CF_ACCOUNT_ID`, `CF_STREAM_API_TOKEN` | no (**new**) | Live broadcasting through Cloudflare Stream (section 4.6, [LIVE.md](LIVE.md)). Without both, the Live page says "not set up yet" and `POST /admin/live/start` answers `503`. The token is a secret (Render only, `sync: false`, never logged). |

On Render: set `ADMIN_ORIGINS` in the service's environment (it is listed in `render.yaml` with `sync: false`), then
redeploy. `ADMIN_APP_URL` and `ADMIN_BOOTSTRAP_EMAILS` have working defaults; set them in the service's environment
only to change them.

## 2. Roles

| Role | Can |
|---|---|
| **viewer** | read the dashboard and every list and detail |
| **editor** | everything a viewer can, plus change and delete orders' shipping state, candles, contacts, site reviews, product reviews, prayers and products, export CSV, and broadcast live (section 4.6) |
| **owner** | everything an editor can, plus delete orders, manage users, read the audit log, end someone else's live broadcast |

The role is enforced on the server for every route (`requireRole`); the UI should only hide what the server would
refuse. A role is read from the database on **every request**: a demotion or a disabled account takes effect at once,
whatever the token says.

| Route | viewer | editor | owner |
|---|:-:|:-:|:-:|
| `GET /admin/dashboard` | yes | yes | yes |
| `GET /admin/{orders,candles,contacts,site-reviews,product-reviews,prayers,products}` and `GET /admin/<same>/:id` | yes | yes | yes |
| `PATCH /admin/{orders,candles,contacts,site-reviews,product-reviews}/:id` | - | yes | yes |
| `DELETE /admin/{candles,contacts,site-reviews,product-reviews,prayers,products}/:id` | - | yes | yes |
| `POST /admin/products`, `PUT`/`PATCH /admin/products/:id` | - | yes | yes |
| `GET /admin/export/{orders,candles,contacts,payments}.csv` | - | yes | yes |
| `GET /admin/payments`, `GET /admin/payments/:id` | yes | yes | yes |
| `PATCH /admin/payments/:id` (resolve with a note, reopen) | - | yes | yes |
| `POST /admin/privacy/lookup`, `POST /admin/privacy/erase` | - | - | yes |
| `GET /admin/settings` (the candle price, its limits, who changed it last) | yes | yes | yes |
| `PUT /admin/settings/candle-price` `{ price }` (1 to 100 USD, two decimals; audited `settings.candle_price` with `from` and `to`) | - | - | yes |
| `GET /admin/candle-videos` | yes | yes | yes |
| `POST /admin/candle-videos`, `POST /admin/candle-videos/:id/{upload-url,uploaded}`, `PATCH`/`DELETE /admin/candle-videos/:id` | - | yes | yes |
| `GET /admin/live`, `POST /admin/live/start`, `POST /admin/live/stop` | - | yes | yes |
| `GET`/`POST /admin/live/recordings`, `POST /admin/live/recordings/:id/{upload-url,uploaded}`, `PATCH`/`DELETE /admin/live/recordings/:id` | - | yes (uploads only for their own broadcasts) | yes |
| `GET`/`POST /admin/live/schedule`, `PATCH`/`DELETE /admin/live/schedule/:id` | - | yes | yes |
| `DELETE /admin/orders/:id` | - | - | yes |
| `/admin/users` (all four) | - | - | yes |
| `GET /admin/audit` | - | - | yes |
| `/admin/auth/*` (own account) | yes | yes | yes |

Public (no token): `POST /admin/auth/login`, `POST /admin/auth/forgot-password` and `POST /admin/auth/reset-password`
(and, outside `/admin`, the live status `GET /live/status`, the published recordings `GET /live/recordings` and the
published schedule `GET /live/schedule`, section 4.6).

## 3. Authentication

### 3.1 Sign in: `POST /admin/auth/login`

```json
{ "username": "saher", "password": "...", "totp": "123456" }
```

`totp` only when the account has two-factor sign-in on.

| Answer | Meaning |
|---|---|
| `200 { token, expiresIn: 3600, user: { id, username, role, totpEnabled } }` | signed in |
| `401 { error: "Invalid credentials" }` | **the only answer** for unknown user, wrong password, wrong code, locked account, disabled account or a malformed body: nothing says which, and the time taken is the same |
| `428 { error: "totp_required" }` | the password was right and the account has TOTP on, but `totp` is missing or is not six digits: send the form again with the code |
| `429` | rate limited (below) |

The token is a JWT, HS256, valid **60 minutes**, payload `{ sub: accountId, role, sid }`. There is no refresh: when it
expires the dashboard asks for the password again. Send it as `Authorization: Bearer <token>`.

**Lockout.** Five consecutive failed attempts (wrong password or wrong code) lock the account for 15 minutes; the
answer is still `401`, and the right password is refused until the lock ends. A successful sign-in resets the
count. An owner can lift a lock early by re-enabling the account (`PATCH /admin/users/:id { "disabled": false }`).

**Rate limit.** 5 failed sign-ins per 15 minutes per address *and* username, 30 per address across usernames.
Successful sign-ins and the `428` prompt do not count.

*Which address?* The dashboard's server calls this API, so the API sees the dashboard host's address plus an
`X-Forwarded-For` the dashboard adds (Netlify's `x-nf-client-connection-ip`, never a header the visitor can write). The
API runs with `trust proxy` 1, i.e. it takes the LAST entry of `X-Forwarded-For`; behind Render's load balancer that is
the dashboard host, not the visitor. So in production the per-address limits are shared by every visitor of the
dashboard and the per-account lockout (5 failures, 15 minutes) is the control that tells people apart. That also means
anyone can lock an account for 15 minutes by guessing wrongly (an owner lifts it by re-enabling the account); see
ADMIN-RUNBOOK.md section 9 (open items).

### 3.2 Sessions: `POST /admin/auth/logout`, `GET /admin/auth/me`

Each sign-in creates a document in `adminSession` (`sid`, account, expiry, `revokedAt`). A token works only while its
session is live, so **sign-out takes effect immediately** (`204`), as do a password change, enabling or disabling
TOTP (all the account's *other* sessions end) and disabling, demoting or deleting an account (all its sessions end).
Revoked sessions stay, flagged, until they expire; a TTL index then removes them (that is the revocation list).

`GET /admin/auth/me` answers `{ id, username, role, totpEnabled, lastLoginAt }`. `401` anywhere means "sign in again";
`403 { error: "Forbidden" }` means "signed in, but your role may not do this".

### 3.3 Password: `POST /admin/auth/password`

```json
{ "currentPassword": "...", "newPassword": "..." }
```

`204` on success; all other sessions end. `403` if the current password is wrong (5 wrong tries per 15 minutes per
account, then `429`). `400` if the new password breaks the policy: **at least 12 characters, at most 200, not the
username (nor the username with a few characters added), not in a list of common passwords, not just repeated
characters, and not equal to the current one.** Passwords are hashed with bcrypt cost 12 and are never trimmed,
altered or logged (the HTML sanitizer that cleans other request bodies skips the sign-in, password and user-creation
bodies, so `&`, `<` and `>` in a password are kept as typed).

### 3.4 Two-factor sign-in (TOTP, RFC 6238)

SHA-1, 6 digits, 30-second steps, one step of drift accepted: what Google Authenticator, Microsoft Authenticator,
Authy and 1Password expect. Implemented with `node:crypto` (no new dependency).

1. `POST /admin/auth/totp/setup { "currentPassword": "..." }` -> `{ secret, otpauthUrl }`. Show the secret (base32) or a
   QR code of `otpauthUrl`. TOTP is **not** on yet. The current password is required (re-authentication, security review
   06 finding 9): `400` without it, `403 Current password is incorrect` (audited as `auth.totp_setup_failed`) when wrong,
   `409` if TOTP is already on. Wrong tries count toward the 5 sensitive failures per account per 15 minutes. The secret
   only ever comes from a re-authenticated setup, so enabling needs only the code.
2. `POST /admin/auth/totp/enable { "code": "123456" }` -> `204` once the app's code is right; `400 Invalid code`
   otherwise. Other sessions end.
3. From now on sign-in needs the code (section 3.1).
4. `POST /admin/auth/totp/disable { "password": "...", "code": "123456" }` -> `204`. `403` for a wrong password or code.

A code works **once**: the last accepted step is stored and that step (or an older one) is refused, so a code that was
just used cannot be replayed within its 30 seconds. A wrong code counts toward the lockout.

**Security audit update (2026-10-07).** TOTP login uses an atomic last-step comparison/update, so two concurrent uses of the same code produce one session. Privacy lookup and erasure also cover payment checkout drafts before payerEmail is populated. Payment repair is an operator CLI action (`scripts/repair-payments.js`), with read-only default and explicit --apply; the dashboard contract is unchanged.

### 3.5 Secrets at rest

The TOTP secret is stored encrypted (AES-256-GCM, random IV per value, authenticated) with a key derived from
`JWT_SECRET` by HKDF-SHA256; a copy of the database alone does not give the second factor. The same HKDF gives a
different key for the audit address hash. The encrypted secret is never returned by the API, never selected by default
(`select: false`) and never written to the log.

### 3.6 Forgotten password: `POST /admin/auth/forgot-password`, `POST /admin/auth/reset-password`

Both are public (no token). Code: `server/route/admin/auth.js`, `server/services/passwordReset.js`.

1. `POST /admin/auth/forgot-password { "email": "..." }` -> **always `202 { ok: true }`**, whether or not an account has
   that address, so the answer never says which addresses exist. When an enabled account has this e-mail (or this
   e-mail as its username; compared without regard to case), the API mails it a link
   `<ADMIN_APP_URL>/reset-password?token=<43 characters>` that works **once, for 30 minutes**. A new request replaces
   the previous link. While no account exists at all, an address in `ADMIN_BOOTSTRAP_EMAILS` first gets an owner
   account (1.1). Audit: `auth.password_reset_requested` (`mailed: true|false`) and `auth.owner_bootstrap`.
2. `POST /admin/auth/reset-password { "token": "...", "password": "..." }` -> `204`. The password follows the policy of
   3.3 (checked against the account's username). Every session of the account ends, a lockout is lifted, two-factor
   sign-in stays as it was. Audit: `auth.password_reset`.

| Answer | Meaning |
|---|---|
| `400 { error: "This link is invalid or has expired. Ask for a new one." }` | unknown, malformed, used or expired token, or a disabled account |
| `400 { error: "Password must ..." }` / `"Password is too common"` / `"Password is too repetitive"` / `"Choose a password"` | the policy refused the password (the link stays valid) |
| `429` | forgot: 3 requests per 15 minutes per address and e-mail, 10 per address (each request can send a mail); reset: 10 failures per 15 minutes per address |

Only SHA-256(token) is stored (`resetTokenHash`, `select: false`, with `resetTokenExpires`); the token itself exists
only in the e-mail. Setting the password and spending the link is one atomic write, so two tabs with the same link
cannot both succeed. Bodies of `/admin/auth/*` skip the HTML sanitizer, so `&`, `<`, `>` in the password are kept.

The dashboard's pages: `/forgot-password` and `/reset-password` ([ADMIN-UI.md](ADMIN-UI.md)); its server routes
`POST /api/session/forgot` and `POST /api/session/reset` pass the requests on and never log the address, the token or
the password.

## 4. Data routes

### 4.1 Lists

`GET /admin/<resource>?page=1&size=25&q=&status=&sort=` answers

```json
{ "items": [ ... ], "total": 137, "page": 1, "size": 25 }
```

- `page` is clamped to 1..10000, `size` to 1..100 (default 25); a value that is not a whole number falls back to the
  default. `?size[]=5` and similar are ignored.
- `q` (at most 100 characters) is a case-insensitive *contains* search over the resource's text fields. It is escaped:
  `.*` searches for those characters. A 24-hex `q` also matches the document id.
- `status` and `sort` are whitelists; anything else is `400`. `sort=field` ascending, `sort=-field` descending
  (default `-createdAt`).

| Resource | `status` | `sort` | `q` searches |
|---|---|---|---|
| `orders` | `pending`, `shipped`, `unverified` (no PayPal-confirmed payment) | `createdAt`, `totalPrice`, `lastName` | name, e-mail, phone, city, country, PayPal id |
| `candles` | `pending`, `done` | `createdAt`, `lastName` | name, e-mail, prayer |
| `contacts` | `open`, `done` | `createdAt`, `fullName` | name, e-mail, phone, message |
| `site-reviews` | `approved`, `hidden` | `createdAt`, `fullName` | name, place, e-mail (older reviews keep the place there), message |
| `product-reviews` | `approved`, `hidden` | `createdAt`, `rating` | name, country, title, comment (the product is populated with its `name`) |
| `prayers` | a category (`Peace`, `Health`, ...) | `createdAt`, `likes` | name, country, prayer |
| `products` | `ok` (not tracked, or more than 5), `low` (stock 0-5), `out` (stock 0) | `createdAt`, `name`, `price`, `stock`, `rate` | name, description, uuid |
| `payments` | `unfulfilled` (paid, no order or candle request saved, past 10 minutes, not resolved), `captured`, `created`, `failed`, `resolved`, `order`, `candle`, `donation` | `createdAt`, `capturedAt`, `amount`, `status` | PayPal id, payer e-mail and name, donor name, note |
| `users` | `active` (not disabled), `owner`, `editor`, `viewer`, `disabled` | `createdAt`, `username`, `lastLoginAt` | username, e-mail |
| `audit` | - (see 5) | `at` | actor, action, target id |

### 4.2 Changes

| Request | Body | Answer |
|---|---|---|
| `GET /admin/<resource>/:id` (orders, candles, contacts, site-reviews, product-reviews, prayers, products) | - | the document (a product review has its product populated with `name`), `404` if missing |
| `PATCH /admin/orders/:id` | `{ "done": true \| false }` | `{ item, emailSent }` |
| `PATCH /admin/candles/:id`, `.../contacts/:id` | `{ "done": boolean }` | `{ item }` |
| `PATCH /admin/payments/:id` | `{ "resolved": true, "note": "..." }` or `{ "resolved": false }` | `{ item }` (section 4.5) |
| `PATCH /admin/site-reviews/:id`, `.../product-reviews/:id` | `{ "approved": boolean }` | `{ item }` |
| `POST /admin/products` | product fields (below) | `201 { item }` |
| `PATCH` or `PUT /admin/products/:id` | any of the product fields (at least one) | `{ item }` |
| `DELETE /admin/<resource>/:id` | - | `{ "message": "..." }`, `404` if missing |

* Ids must be 24 hexadecimal characters (`400 Invalid id`).
* **Shipping an order** (`done: true`) e-mails the customer ("Your order was shipped", the mail the removed
  `/order/orderSent` used to send) - but **once**: marking an already shipped order again sends nothing (`emailSent: null`). If the
  mail cannot be sent the change is kept and the answer says `emailSent: false`, so the admin can write to the
  customer. Un-shipping sends nothing. `emailSent` is `true`, `false` or `null` (no mail was due).
* Changing a product, or a product review, refreshes the storefront catalogue cache at once.
* **Product fields** (anything else is refused): `name` (2-200), `price` (0.01-10000), `img` (http(s) address),
  `additionalImageUrls` (up to 20 addresses), `description` (up to 2000), `uuidv4_` (up to 64), `rate` (0-5, the
  featuring weight the storefront ranks by), `color` (up to 20 words), `stock` (whole number >= 0, or `null` = not
  tracked), `category` (one of `stained-glass`, `rosaries`, `necklaces`, `bracelets`, `bibles`, `crosses`,
  `holy-land`, `gifts`, or `null` = infer from the name; an override wins over the name). `name`, `price` and `img`
  are required on create.
* **Text is stored HTML-escaped.** The API's sanitizer turns a stray `&`, `<`, `>` in body text into `&amp;`, `&lt;`, `&gt;` (see
  SECURITY.md 4.3), removes scripts and event handlers, and keeps a small set of harmless tags (`<b>`, `<i>`, `<a href="https://...">`) as they were typed (checked against the running sanitizer: the dashboard shows them as text, never as HTML); responses return what is stored. **Decode those three entities when putting a value into an
  edit field, send the raw text back, and the API escapes it once.** (Web addresses are the exception: `&amp;` in an
  address is decoded before it is saved, so Firebase links keep working.) **Lengths are checked after that escaping**:
  a 2,000-character description with one `&` is 2,004 characters for the API. The dashboard's forms count the same
  way (`admin/src/lib/entities.ts`, `storedLength`); every form's limits are in `docs/FORM-CONTRACTS.md`.

### 4.3 Dashboard: `GET /admin/dashboard`

One request, computed by the database (aggregations and counts, nothing is loaded into memory), **cached 30 seconds**:

```json
{
  "generatedAt": "2026-10-06T10:00:00.000Z",
  "totals": { "orders": 0, "ordersPending": 0, "revenue": 0, "candles": 0, "candlesPending": 0,
              "contacts": 0, "contactsOpen": 0, "products": 0, "productReviews": 0, "prayers": 0, "reviews": 0 },
  "last30Days": [ { "date": "2026-09-07", "orders": 0, "revenue": 0, "candles": 0 }, "... 30 entries, zero-filled" ],
  "topProducts": [ { "productId": "...", "name": "...", "sold": 0, "revenue": 0 } ],
  "lowStock": [ { "productId": "...", "name": "...", "stock": 0 } ],
  "recent": { "orders": [ "5 newest, with name, e-mail, total, done, paymentVerified" ], "candles": [ "5, with name, e-mail, prayer, done" ], "contacts": [ "5, with name, e-mail, msg, done" ] },
  "alerts": { "unfulfilledPayments": { "count": 0, "amount": 0 } }
}
```

Days are Nazareth days (`Asia/Jerusalem`), oldest first, ending today. `revenue` is the sum of order `totalPrice`
(USD) over **all** orders, including ones saved without a verified PayPal payment (filter `status=unverified` in the
list to see those). Orders do not store a price per line, so a product's `revenue` is **units sold x the product's
current price**, an estimate. `lowStock` is tracked stock of 5 or less (at most 20 products, lowest first).
`alerts.unfulfilledPayments` is the number and the total (USD) of customers who paid but have no saved order or candle request (section 4.5):
the dashboard shows it as a warning and a figure. An API that predates the payment ledger simply has no `alerts`.

### 4.4 CSV export: `GET /admin/export/orders.csv` (also `candles.csv`, `contacts.csv`, `payments.csv`)

Editor or owner (it is a bulk copy of personal data). Newest first, at most 10 000 rows, UTF-8 with a byte-order mark so
Excel reads Hebrew and Arabic, `Content-Disposition: attachment`. **Formula injection is neutralised:** a text cell
starting with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe; cells with commas, quotes or
line breaks are quoted (RFC 4180). Stored `&amp;` etc. are decoded to the characters. Each export is audited.
`payments.csv` also accepts `?status=unfulfilled` (only the customers who paid and have nothing saved; any other value is `400`).

### 4.5 Payments: `/admin/payments` (the payment ledger)

Every PayPal order the API creates has one row (server/model/payment.js, docs/DATABASE.md section 2): written when the order is created, completed when PayPal confirms the
capture, linked to the order or candle request when the browser saves it. A donation has only this row. The dashboard's **Payments** screen reads these routes.

* `GET /admin/payments?page&size&q&status&sort`: the list (4.1). An item: `{ _id, paypalOrderId, type, amount, currency, status, capturedAt, payerEmail, payerName, donorName, linkedTo: { kind, id }, resolvedAt, resolvedBy, notes, createdAt }`.
  `type` is `order`, `candle`, `donation` or `unknown` (an old client); `status` is `created`, `captured` or `failed`.
* `GET /admin/payments/:id`: one payment.
* `PATCH /admin/payments/:id` (editor): `{ "resolved": true, "note": "Refunded in PayPal" }` marks a payment dealt with (the **note is required**, 1-1000 characters, and the admin's name and the time are recorded);
  `{ "resolved": false }` reopens it. Resolving a payment that is already linked to an order or candle is `409`. Anything else in the body is `400`: the amount, status and link cannot be edited.
* **There is no `DELETE`, `POST` or `PUT`**: nothing in the ledger is removed through the API.
* *Unfulfilled* means: captured, for an order, a candle or an old client, with no order or candle request pointing at it, not resolved, and captured **more than 10 minutes ago** (before that the customer's browser is simply still saving it). Donations are never unfulfilled.

Every change is audited (`payment.update`, with `resolved` and the PayPal id).

### 4.6 Live broadcasting: `/admin/live` (editor and owner)

The camera of the admin's phone or computer is published from the browser to Cloudflare Stream (WebRTC, WHIP) and shown on
the website's `/live` page. Architecture, costs, limits and the owner's set-up: [LIVE.md](LIVE.md). Code:
`server/route/admin/live.js`, `server/services/live.js`, `server/services/cloudflareStream.js`, `server/model/liveSession.js`;
recordings `server/route/admin/liveRecordings.js`, `server/services/liveRecordings.js`, `server/model/liveRecording.js`; the schedule
`server/route/admin/liveSchedule.js`, `server/services/liveSchedule.js`, `server/model/scheduledBroadcast.js`.

A session: `{ _id, title, status: "live"|"ended", inputUid, whepUrl, playbackUrl, startedAt, endedAt, endReason, startedBy: { id, name },
endedBy: { id, name } | null, inputDeleted }`. `endReason` is `stopped` (by who started it), `forced` (by an owner), `auto` (after
6 hours) or `failed`. `whepUrl` and `playbackUrl` are public addresses (every viewer gets them).

| Request | Body | Answer |
|---|---|---|
| `GET /admin/live` | - | `{ configured, maxMinutes: 360, current: session \| null, history: [10 most recent sessions] }`. A broadcast live for more than 6 hours is ended first. |
| `POST /admin/live/start` | `{ "title": "...", "scheduleId"?: "<24 hex>" }` (title 1-120 characters, one line; nothing else) | `201 { session, whipUrl }`. `409 { error, current }` while another one is live (also when two start at the same moment: a unique index decides); `503` when `CF_ACCOUNT_ID` / `CF_STREAM_API_TOKEN` are missing; `502` when Cloudflare refuses or cannot be reached (nothing is saved). With `scheduleId` the scheduled broadcast becomes `live` (linked to the session) and `done` when the session ends; an unknown one is `404`, one that is not `scheduled` (live, done, cancelled) `409`, both before Cloudflare is asked. |
| `POST /admin/live/stop` | `{ "sessionId"?: "<24 hex>", "force"?: true }` | `{ stopped: true, session }`. Nothing live, or `sessionId` names one that already ended: `{ stopped: false, session: null }` (a late "stop" from a closed tab never ends the NEXT broadcast). Someone else's broadcast: an editor gets `403`; an owner gets `409 { error, current }` unless `force: true`. The Cloudflare input is deleted (best effort: a failure is logged with the input id and kept as `inputDeleted: false`). |

**`whipUrl` is a secret** (Cloudflare's publish address with the input's broadcast secret in it): it is in exactly one
answer, the `201` of start, to the admin who started it. It is not stored, not in any other answer, not in the audit log
and not in the log (tested). Audit actions: `live.start` (title, input id), `live.stop` (`reason`, `minutes`,
`inputDeleted`), `live.auto_end` (actor `system`), `live.start_failed`.

**Public:** `GET /live/status` (no token) answers `{ "live": false }` or `{ "live": true, "id", "title", "startedAt", "playbackUrl" }`
(`id` = the session id, so the website shows its "we are live" window once per broadcast; `playbackUrl` =
`https://customer-<code>.cloudflarestream.com/<input id>/iframe`, Cloudflare's player). It is answered from
memory for 5 seconds, carries `Cache-Control: public, max-age=5, s-maxage=5`, and has its own rate limit (3000 per 15
minutes per address). The old `/live/create_room`, `/live/room_id`, `/live/close_room` were removed (LIVE.md section 3).

#### Recordings: `/admin/live/recordings` (LIVE.md section 9)

The admin's browser records the broadcast and uploads the file **straight to Cloudflare Stream** (tus, a one-time
address the API asks Cloudflare for); the API never receives the video. A recording:
`{ _id, session, title, liveStartedAt, liveEndedAt, durationSeconds, sizeBytes, mimeType, cfVideoUid, status: "uploading"|"processing"|"ready"|"failed",
failReason, published, publishedAt, thumbnailUrl, playbackUrl, createdBy: { id, name }, createdAt }` (`thumbnailUrl` and `playbackUrl` are
derived from the video id and the account's customer code: `https://customer-<code>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg` and `.../<uid>/iframe`).

| Request | Body | Answer |
|---|---|---|
| `GET /admin/live/recordings` | - | `{ configured, items: [up to 100, newest broadcast first], storage: { usedMinutes, limitMinutes, videos, source: "cloudflare"\|"estimate", pricePer1000Minutes: 5 } }`. Unfinished ones (uploading, processing) are checked with Cloudflare first (`GET /stream/<uid>`: state, `readyToStream`, duration), at most every 10 seconds each and 10 per read; a recording never moves backwards. `storage` is Cloudflare's own figure (`GET /stream/storage-usage`, cached a minute), or the sum of our recordings when Cloudflare does not answer. |
| `POST /admin/live/recordings` | `{ sessionId, sizeBytes (1 B to 30 GB), durationSeconds (0-21600), mimeType ("video/mp4" or "video/webm", "video/x-matroska", with codecs), title? (1-120; default: the broadcast's) }` | `201 { recordingId, uploadUrl, recording }`. Only for a broadcast the caller started, or any for an owner (`403`); unknown broadcast `404`; a broadcast that already has a recording `409 { error, recording }` (also for two at the same moment); `503` not configured; `502` Cloudflare refused (audited `live.recording_failed`). Cloudflare is told the size, a name, a maximum length (the measured one plus 20% and 5 minutes, at most 6 hours) and an expiry four hours ahead. |
| `POST /admin/live/recordings/:id/upload-url` | `{ sizeBytes, durationSeconds?, mimeType? }` | `{ recordingId, uploadUrl, recording }`: a new address for an upload that did not finish (expired, a browser that died); a new Cloudflare video, the old one is deleted, the upload starts again from the beginning. Only while `uploading` or `failed` (`409` otherwise); same permission as creating. |
| `POST /admin/live/recordings/:id/uploaded` | `{}` | `{ recording }`: the browser sent the last byte: `processing` (or already `ready`: Cloudflare is asked at once). Saying it twice changes nothing; a `failed` one is `409`. Same permission as creating. |
| `PATCH /admin/live/recordings/:id` | `{ title?, published? }` (at least one) | `{ recording }`. **Publishing only when `ready`**: otherwise Cloudflare is asked once more, then `409 { error, recording }`. Unpublishing and renaming always work. Any editor or owner. |
| `DELETE /admin/live/recordings/:id` | - | `{ deleted: true, cloudflareDeleted }`: the row is removed and the Cloudflare video deleted (best effort: a failure is logged with the video id). Any editor or owner. |

**`uploadUrl` is a secret of sorts** (whoever holds it can upload one video into the account until it is used or
expires): it is in exactly one answer, to the admin who asked; never stored, never logged, never in another answer
(tested). A recording that Cloudflare cannot encode becomes `failed` (and unpublished); one that disappears at
Cloudflare while processing too; an upload address nobody used is given up after 48 hours.

**Public:** `GET /live/recordings` answers `{ "items": [{ "id", "title", "date", "durationSeconds", "thumbnailUrl", "playbackUrl" }] }`
(published **and** ready only, newest broadcast first, at most 50; `date` = when the broadcast was live), from memory for a
minute (reset at once by every change in the dashboard), `Cache-Control: public, max-age=30, s-maxage=30, ...`, the public-read
rate limit (1000 per 15 minutes per address).

#### Scheduled broadcasts: `/admin/live/schedule` (LIVE.md section 10)

An item: `{ _id, title, description, startsAt (UTC), startsAtLocal ("YYYY-MM-DDTHH:MM" in Nazareth), timeZone: "Asia/Jerusalem", published,
status: "scheduled"|"live"|"done"|"cancelled", liveSession, createdBy, updatedAt }`.

| Request | Body | Answer |
|---|---|---|
| `GET /admin/live/schedule` | - | `{ timeZone, items }`: the live one and everything from seven days ago on, soonest first (at most 100). |
| `POST /admin/live/schedule` | `{ title (1-120), description? (0-500, may have line breaks), startsAtLocal ("2026-10-20T19:30", **Nazareth time**), published? (default false) }` | `201 { item }`. The time is converted to UTC by the API (the hour skipped in spring moves forward by an hour; the hour repeated in autumn is the first, summer-time one). `400` for a time that does not exist as a date, more than five minutes ago, or more than about a year ahead. |
| `PATCH /admin/live/schedule/:id` | `{ title?, description?, startsAtLocal?, published?, status?: "scheduled"\|"cancelled" }` (at least one) | `{ item }`. The time and the status of an item that is `live` or `done` cannot change (`409`); its title, description and publication can. `live` and `done` are set only by starting and ending a broadcast. |
| `DELETE /admin/live/schedule/:id` | - | `{ deleted: true }`; a `live` one is `409`. |

**Public:** `GET /live/schedule` answers `{ "timeZone": "Asia/Jerusalem", "items": [{ "id", "title", "description", "startsAt", "status" }] }`:
published, `scheduled` or `live`, starting after now minus two hours (an item that was never started drops off by itself two
hours after its time), soonest first, at most 10; from memory for 30 seconds (reset by every change), the same
Cache-Control and rate limit as the recordings.

## 5. Users and audit

### 5.1 Users (owner only)

* `GET /admin/users`: `{ items, total, page, size }`; each item `{ _id, username, email, role, disabled, totpEnabled,
  lockedUntil, lastLoginAt, createdAt }`. Never a hash or secret.
* `POST /admin/users { username, password, role }`: `201 { item }`. `username`: 3-64 characters, letters, digits and
  `. _ -`, starting with a letter or digit; names that differ only by case are the same name (`409`). `role`:
  `owner`, `editor` or `viewer`. Password policy as in 3.3.
* `PATCH /admin/users/:id { role?, disabled?, resetTotp? }` (at least one): change the role, disable or enable the
  account (enabling also lifts a lockout), or **reset the account's two-factor sign-in** (recovery for someone who lost
  their phone: they sign in with the password alone and set TOTP up again). Disabling, changing the role and resetting
  TOTP end all of the account's sessions.
* `DELETE /admin/users/:id`: deletes the account and ends its sessions.

**Guards (all `400`/`409`, all tested):** nobody can delete or disable themselves, change their own role, or reset
their own TOTP (use `/admin/auth/totp/disable`); and the **last enabled owner can never be deleted, disabled or
demoted** (`409`). That last rule can only trigger in a race, because the person acting is always an enabled owner; it
is a safety net for two owners changing each other at the same moment. Nobody can grant themselves anything: only an
owner reaches these routes, and an owner already has everything.

### 5.2 Audit: `GET /admin/audit?page&size&actor&action` (owner only)

Newest first (`sort=at` for oldest first). `actor` is an account name (exact); `action` is exact, or a prefix ending in a
dot (`auth.` = every sign-in event). `q` searches actor, action and target id.

Each entry: `{ at, actorId, actorName, role, action, target: { type, id }, meta, ipHash, ua }`. `ipHash` is a keyed hash
of the address: the same address always gives the same value (repeated attempts are visible), the address cannot be
read back. `ua` is a short summary such as `Chrome 126 / Windows`. Entries expire after **180 days** (TTL index).

Everything is written by one helper, `audit(req, action, target, meta)` (`server/services/audit.js`), which cleans
`meta` (secret-looking keys dropped, strings clipped), never receives a password, token or code, and never fails a
request when the log cannot be written. Actions recorded:

| Prefix | Actions |
|---|---|
| `auth.` | `login`, `login_failed` (with a `reason` such as `wrong_password`, `unknown_user`, `locked`, `wrong_totp`), `account_locked`, `logout`, `password_change`, `password_change_failed`, `totp_setup`, `totp_enable`, `totp_enable_failed`, `totp_disable`, `totp_disable_failed` |
| `order.` `candle.` `contact.` `site-review.` `product-review.` `prayer.` `product.` | `update`, `delete` (and `product.create`) |
| `export.` | `orders`, `candles`, `contacts`, `payments` (with the row count) |
| `payment.` | `update` (resolve / reopen) |
| `privacy.` | `lookup`, `erase` (the counts and a keyed hash of the address: never the address) |
| `live.` | `start` (with `scheduleId` when it fulfils a scheduled broadcast), `stop`, `auto_end`, `start_failed` (section 4.6; never the publish address); recordings: `recording_create`, `recording_renew`, `recording_uploaded`, `recording_update` (title, published), `recording_delete` (with `cloudflareDeleted`), `recording_status` (actor `system`: Cloudflare finished or failed), `recording_failed` (Cloudflare refused an upload address); never the upload address. Schedule: `schedule_create`, `schedule_update`, `schedule_delete` |
| `user.` | `create`, `update`, `delete` |

A failed sign-in is recorded with the name that was typed (no account was proven).

### 5.3 Privacy requests (owner only): `POST /admin/privacy/lookup` and `/erase`

`{ "email": "...", "name"?: "...", "country"?: "..." }` answers `{ "found": { orders, candles, contacts, reviews, payments, prayers, productReviews }, "notSearched": [...] }`: counts only, no personal data.
`{ "email": "...", "confirm": "...", "name"?, "country"? }` (the same address typed again, case does not matter) erases it: orders and candle requests are **anonymised** (name, address, phone, e-mail, prayer
text replaced by "Erased"; the sale and its total stay), contact messages and site reviews are **deleted**, the payer's e-mail and names are removed from payments (amount and PayPal id stay).

Prayers and product reviews keep no e-mail address. They are found by what they were **published** under, and only when it is **exactly equal** (any case; the HTML-escaped form the API stores counts
as equal; no wildcard, a "." is a dot): both need `name` **and** `country` (a name alone is shared by strangers; a product review published without a country is not found this way). Both are **deleted**; erasing a product
review rebuilds the storefront's ratings. A `country` without a `name` is `400`; `name` is 2-200 characters, `country` 1-100. Anything similar but not equal (a nickname, another spelling, the same
name from another country) is **not** touched: the owner checks it on the Prayers or Reviews page and deletes it there. `notSearched` lists `prayersNotSearched` / `productReviewsNotSearched` when the
request did not identify them.

The erase answers `{ "erased": { ...counts }, "notErased": [...] }`. `notErased` is the to-do list of what this route cannot reach, in this order: what was not searched (above), then
`gmailSent` (copies of the confirmation mails in the Gmail Sent folder), `backups` (until rotated out, at most 30 days), `recordings` (Cloudflare Stream; not linked to a person), `paypal` (PayPal's
own record) and `hostLogs` (Cloudflare, Render, Netlify request logs). The dashboard shows it as a list after the erase; docs/DATABASE.md section 8 has the manual steps.

The address must be a valid one and not the placeholder erased records carry (`erased@erased.invalid`); 20 requests per 15 minutes per owner; both calls are audited with a keyed hash of the address and
the counts, never the address, the name or the country. The policy is in docs/DATABASE.md sections 7 and 8.

### 5.4 Settings: the candle price (`/pricing` in the dashboard)

`GET /admin/settings` answers `{ candlePrice, candlePriceMin, candlePriceMax, currency, updatedAt, updatedBy }` to every
role; `PUT /admin/settings/candle-price { price }` is the owner's (1 to 100 USD, at most two decimals, a strict body: 400
otherwise, 403 for an editor or a viewer). The value lives in `model/siteSetting.js` (one document, key `site`) and is read
through `services/siteSettings.js` (cached 30 seconds, dropped at once on a change). `create_order` charges it; a candle is
then checked against the price its payment was **started** with (the ledger's amount, rows of type `candle` only), so a change
never blocks a customer who has already paid. The website reads `GET /candle/price` (public, cached a minute) for the candle
page, the FAQ and the terms, and falls back to the built-in `$3` when the API cannot be reached.

### 5.5 The candle page's videos (`/candle-videos` in the dashboard)

Short films for the website's candle page (for example how the candles are lit), not tied to a broadcast. Model
`model/candleVideo.js`, service `services/candleVideos.js`, routes `route/admin/candleVideos.js`. The upload uses the same
pipeline as the broadcast recordings (docs/LIVE.md): `POST /admin/candle-videos { title, sizeBytes, mimeType }` asks
Cloudflare Stream for a one-time tus address (MP4, MOV, WebM or MKV, at most 2 GB and 30 minutes; at most 20 videos), the
browser sends the file straight to Cloudflare, then `POST /:id/uploaded` asks Cloudflare how far it got
(uploading -> processing -> ready, or failed; also checked on every list read). A video is published only once it is
ready (`PATCH { published: true }`, 409 before). `DELETE` also deletes it at Cloudflare. Every write is audited
(`candle_video.create`, `.renew`, `.update`, `.delete`, `.status`). Without `CF_ACCOUNT_ID` and `CF_STREAM_API_TOKEN` the
list says "not set up" and an upload answers 503. The website reads `GET /candle/videos` (published and ready, newest first,
public, cached a minute; only Cloudflare Stream addresses are accepted) and shows a section below the form only when there
is at least one: a poster button per video, and Cloudflare's player only after a press.

## 6. Operations

* **Unlock an account:** an owner re-enables it (`PATCH /admin/users/:id { "disabled": false }`), or wait 15 minutes.
* **Someone lost their authenticator:** an owner sends `PATCH /admin/users/:id { "resetTotp": true }`. If the **only**
  owner lost theirs, remove the three fields by hand in MongoDB
  (`db.admins.updateOne({ username: "..." }, { $set: { totpEnabled: false, totpSecretEnc: null } })`).
* **Rotating `JWT_SECRET`:** all dashboard tokens stop working (everyone signs in again), and every stored
  TOTP secret becomes unreadable - those users cannot pass the code step (the answer is the same generic `401`, the
  audit log says `totp_secret_unreadable`) until an owner resets their TOTP. Plan the rotation with that in mind.
* **A suspected stolen token:** sign out everywhere by changing the password (all other sessions end) or disabling and
  re-enabling the account (all sessions end). A stolen token cannot change the password (it needs the current one),
  turn TOTP off (it needs the password and a code) or turn TOTP on (setting it up needs the current password, since
  2026-10-07); attempts are audited (`auth.totp_setup_failed`, `auth.password_change_failed`).
* **Retention:** audit entries 180 days, sessions until they expire (60 minutes), by TTL indexes (created when the
  server starts; allow MongoDB's TTL monitor up to a minute to purge).

## 7. The old sign-ins and their routes were removed (2026-10-07)

`POST /auth/login { password }` (the shared `ADMIN_PASSWORD`) and `POST /admin/login { username, password }` (an
`Admin` account, an 8-hour token with no session, no role, no lockout, no second factor, no audit) were **removed** with
every route that accepted their tokens (security review 06, finding 1: any account's password, even a viewer's, a
disabled or a locked one, or one with TOTP on, gave an 8-hour token that read every order, candle request and message):

* `route/authRoute.js`, `route/adminRoute.js` (`/admin/login`, `/admin/stats` and the legacy `/admin/prayers`,
  `/admin/candles`, `/admin/products`, `/admin/product-reviews` handlers) and `middleware/auth.js` (`requireAdmin`);
* `/order/getAllOrders`, `/order/getOrder/:id`, `/order/orderSent/:id`, `/order/deleteOrder/:id`;
* `/candle/getAllCandleRequests`, `/candle/set_request_done/:id`, `/candle/delete_lighting_request/:id`;
* `/contact/get_all_contact_us`, `/contact/get_request/:id`, `/contact/request_done/:id`, `/contact/delete_request/:id`;
* `/product/addProduct`, `/product/updateProduct/:id`, `/product/deleteProduct/:id`; `DELETE /prayer/:id` and `/review/:id`.

The removed addresses answer `404`. Where the dashboard has a route at the same address (`/admin/prayers`, ...), it
answers `401` to anything but a live session's token, so **a legacy token issued before the change opens nothing**:
`verifySessionToken` (`services/adminSessions.js`) accepts only `{ sub, sid, role }` tokens of at most 60 minutes.
`JWT_SECRET` was not rotated (it also keys the TOTP encryption). No code in `web/` or `admin/` called these routes; the
old admin site (`nazaretholycrossadmin.netlify.app`) calls a Heroku app that no longer exists, and its origin is no
longer trusted by CORS. `ADMIN_PASSWORD` is no longer required (section 1.2): delete it on Render.

The one "read everything" route left is the public `/product/getAllProducts`: a plain array, **newest first and at most
5,000 documents**, with an `X-Result-Capped: 5000` header when the cap was reached. Private data is read only through the
paginated dashboard routes above.

## 8. Security model in one page

| Concern | Control |
|---|---|
| Who is calling | personal accounts; bcrypt cost 12; password policy; optional TOTP |
| Forgotten password | one-time 30-minute link by e-mail, only its SHA-256 stored; the same `202` for every address; 3 requests per address and e-mail, 10 per address; a reset ends every session of the account |
| Brute force | per address + username limit (5/15 min), per address limit (30), account lockout (5 -> 15 min), constant work for unknown users, one generic `401` |
| Stolen or leaked token | 60-minute lifetime, server-side session per token (revocable at once), HS256 pinned (no `none`, no other algorithm), role read from the database each request |
| Privilege | role checked on every route; strict bodies (unknown fields refused); no one can grant themselves anything; last-owner and self-protection guards |
| Injection | every body validated (type first, bounds, whitelists); queries only from whitelisted fields; `q` escaped; operators marked `mongoose.trusted` only where we write them; tests run every filter through `mongoose.sanitizeFilter` |
| Spreadsheet attacks | CSV cells neutralised |
| Data exposure | `no-store` on all admin answers; no hashes, TOTP secrets, session ids in any answer; audit stores a keyed address hash, not the address |
| Browser | CORS only for `ADMIN_ORIGINS` and our own sites; no cookies (token in the `Authorization` header), so no CSRF |
| Errors and logs | no stack traces or database text in production; passwords, tokens and codes never logged (tested) |
| Resources | 10 KB body limit; page size at most 100; export at most 10 000 rows; per-admin limit 300/15 min; dashboard cached 30 s |
| Timing | password and code comparisons are constant-time (bcrypt, `timingSafeEqual`, hashed `safeEqual`) |

Not covered: a compromised owner account (use TOTP), a compromised Render/MongoDB account, and rate-limit counters being
per process (single Render instance; a shared store is needed to scale out - SECURITY.md 4.2).

## 9. For the dashboard's author

* Keep the token in memory (or `sessionStorage`), send it in `Authorization`; there are no cookies. On `401` go to the
  sign-in page; on `403` show "not allowed"; on `429` wait; on `428` show the code field.
* Hide what the role cannot do, but never rely on it.
* Pages are `{ items, total, page, size }`; build "page x of y" from `ceil(total / size)`.
* Decode the three HTML entities in stored text for display and edit fields (4.2).
* Show `emailSent: false` after shipping an order: the customer was not notified.
* The token cannot be refreshed: plan for a re-sign-in every hour (the `expiresIn` field is in seconds).

## 10. Running the dashboard against this code without a database

`server/test-harness` runs this exact Express app over in-memory models (no MongoDB, no mail, no PayPal; see its
README for the throw-away accounts): `cd server && npm run harness` serves it on 127.0.0.1:3912. The dashboard's
end-to-end suite runs against it (`cd admin && npm run test:e2e:harness`), and a parity test makes the dashboard's
mock API answer exactly like it. Running them together found the mismatches listed in
[ADMIN-RUNBOOK.md](ADMIN-RUNBOOK.md) section 8 (all fixed, each with a regression test).

## 10b. Tests

`server/__tests__/admin-*.test.js` and `totp.test.js`: sign-in, lockout, rate limits, TOTP (RFC 6238 and RFC 4226
vectors, replay), sessions and revocation, password change, the role matrix over every route (every role, no token,
old tokens), lists and pagination bounds, search escaping, order shipping and mail, products validation, CSV
injection, dashboard, users and guards, audit, CORS, headers, error answers, secrets out of logs, the create-admin
script, the models' indexes, and the old admin routes. The database is replaced by an in-memory stand-in
(`test-harness/fake-models.js`, re-exported by `__tests__/helpers/fakes.js`); **nothing was run against a real MongoDB** (section 11).

## 11. What is not verified

* No test ran against a real MongoDB or on Render. The fakes understand the operators the routes use; the sanitizeFilter
  test guards the main difference, but compound behaviour (index creation, TTL purge timing, real casting) was not
  observed. Run the first sign-in and one of each change on a staging database before pointing production at it.
* **Indexes are built by the server at start-up, in production too** (docs/DATABASE.md section 5; `AUTO_INDEX=false` turns it off). This release adds the unique `payment.paypalOrderId` index. After the deploy, check on Atlas that it exists and that `auditLog` and `adminSession` show the expiry indexes; `node scripts/ensure-indexes.js` (dry run) lists anything missing.
* No e-mail was sent (the mailer is mocked); the shipped-order mail uses the same `sendMail` as before. The same holds
  for the password-reset mail: the first real one is the owner's first request on production (ADMIN-RUNBOOK.md 2).
