# The admin dashboard API

The API behind the new admin dashboard (`server/route/admin/*`). It replaces the single shared admin password with
personal accounts, roles, optional two-factor sign-in, sessions that can be ended at once, and an audit log.
Threat model and the rest of the API's protections: [SECURITY.md](SECURITY.md) (section 4.1).

Everything below is under the API origin (Render: `https://nazareth-holy-cross-api.onrender.com`). Bodies are JSON.
Every error is `{ "error": "text" }`; every answer under `/admin` carries `Cache-Control: no-store`.

## 1. Setting it up

### 1.1 The first owner

Accounts are created by an owner in the dashboard (`POST /admin/users`). The first owner is created from a terminal:

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
| `ADMIN_ORIGINS` | **new**, for the dashboard | Comma-separated exact browser origins of the dashboard, e.g. `https://admin.nazarethholycross.com`. Added to the CORS allow-list. No wildcards; a trailing slash is ignored. Without it the dashboard cannot call the API from a browser (the old admin site's `*.netlify.app` addresses are allowed as before). |
| `DATABASEURL` | yes (already) | MongoDB. New collections: `adminSession`, `auditLog`. |
| `ADMIN_PASSWORD` | yes (already) | Only for the deprecated shared-password sign-in (section 7). |

On Render: set `ADMIN_ORIGINS` in the service's environment (it is listed in `render.yaml` with `sync: false`), then
redeploy. No other variable is new.

## 2. Roles

| Role | Can |
|---|---|
| **viewer** | read the dashboard and every list and detail |
| **editor** | everything a viewer can, plus change and delete orders' shipping state, candles, contacts, site reviews, product reviews, prayers and products, and export CSV |
| **owner** | everything an editor can, plus delete orders, manage users, read the audit log |

The role is enforced on the server for every route (`requireRole`); the UI should only hide what the server would
refuse. A role is read from the database on **every request**: a demotion or a disabled account takes effect at once,
whatever the token says.

| Route | viewer | editor | owner |
|---|:-:|:-:|:-:|
| `GET /admin/dashboard` | yes | yes | yes |
| `GET /admin/{orders,candles,contacts,site-reviews,product-reviews,prayers,products}` and `GET /admin/{orders,products}/:id` | yes | yes | yes |
| `PATCH /admin/{orders,candles,contacts,site-reviews,product-reviews}/:id` | - | yes | yes |
| `DELETE /admin/{candles,contacts,site-reviews,product-reviews,prayers,products}/:id` | - | yes | yes |
| `POST /admin/products`, `PUT`/`PATCH /admin/products/:id` | - | yes | yes |
| `GET /admin/export/{orders,candles,contacts}.csv` | - | yes | yes |
| `DELETE /admin/orders/:id` | - | - | yes |
| `/admin/users` (all four) | - | - | yes |
| `GET /admin/audit` | - | - | yes |
| `/admin/auth/*` (own account) | yes | yes | yes |

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

1. `POST /admin/auth/totp/setup` -> `{ secret, otpauthUrl }`. Show the secret (base32) or a QR code of `otpauthUrl`. TOTP
   is **not** on yet. (`409` if it already is.)
2. `POST /admin/auth/totp/enable { "code": "123456" }` -> `204` once the app's code is right; `400 Invalid code`
   otherwise. Other sessions end.
3. From now on sign-in needs the code (section 3.1).
4. `POST /admin/auth/totp/disable { "password": "...", "code": "123456" }` -> `204`. `403` for a wrong password or code.

A code works **once**: the last accepted step is stored and that step (or an older one) is refused, so a code that was
just used cannot be replayed within its 30 seconds. A wrong code counts toward the lockout.

### 3.5 Secrets at rest

The TOTP secret is stored encrypted (AES-256-GCM, random IV per value, authenticated) with a key derived from
`JWT_SECRET` by HKDF-SHA256; a copy of the database alone does not give the second factor. The same HKDF gives a
different key for the audit address hash. The encrypted secret is never returned by the API, never selected by default
(`select: false`) and never written to the log.

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
| `site-reviews` | `approved`, `hidden` | `createdAt`, `fullName` | name, e-mail, message |
| `product-reviews` | `approved`, `hidden` | `createdAt`, `rating` | name, country, title, comment (the product is populated with its `name`) |
| `prayers` | a category (`Peace`, `Health`, ...) | `createdAt`, `likes` | name, country, prayer |
| `products` | `low` (stock 0-5), `out` (stock 0) | `createdAt`, `name`, `price`, `stock`, `rate` | name, description, uuid |
| `users` | `owner`, `editor`, `viewer`, `disabled` | `createdAt`, `username`, `lastLoginAt` | username, e-mail |
| `audit` | - (see 5) | `at` | actor, action, target id |

### 4.2 Changes

| Request | Body | Answer |
|---|---|---|
| `GET /admin/orders/:id`, `GET /admin/products/:id` | - | the document, `404` if missing |
| `PATCH /admin/orders/:id` | `{ "done": true \| false }` | `{ item, emailSent }` |
| `PATCH /admin/candles/:id`, `.../contacts/:id` | `{ "done": boolean }` | `{ item }` |
| `PATCH /admin/site-reviews/:id`, `.../product-reviews/:id` | `{ "approved": boolean }` | `{ item }` |
| `POST /admin/products` | product fields (below) | `201 { item }` |
| `PATCH` or `PUT /admin/products/:id` | any of the product fields (at least one) | `{ item }` |
| `DELETE /admin/<resource>/:id` | - | `{ "message": "..." }`, `404` if missing |

* Ids must be 24 hexadecimal characters (`400 Invalid id`).
* **Shipping an order** (`done: true`) e-mails the customer ("Your order was shipped"), exactly like the old
  `/order/orderSent` - but **once**: marking an already shipped order again sends nothing (`emailSent: null`). If the
  mail cannot be sent the change is kept and the answer says `emailSent: false`, so the admin can write to the
  customer. Un-shipping sends nothing. `emailSent` is `true`, `false` or `null` (no mail was due).
* Changing a product, or a product review, refreshes the storefront catalogue cache at once.
* **Product fields** (anything else is refused): `name` (2-200), `price` (0.01-10000), `img` (http(s) address),
  `additionalImageUrls` (up to 20 addresses), `description` (up to 2000), `uuidv4_` (up to 64), `rate` (0-5, the
  featuring weight the storefront ranks by), `color` (up to 20 words), `stock` (whole number >= 0, or `null` = not
  tracked), `category` (one of `stained-glass`, `rosaries`, `necklaces`, `bracelets`, `bibles`, `crosses`,
  `holy-land`, `gifts`, or `null` = infer from the name; an override wins over the name). `name`, `price` and `img`
  are required on create.
* **Text is stored HTML-escaped.** The API's sanitizer turns `&`, `<`, `>` in body text into `&amp;`, `&lt;`, `&gt;` (see
  SECURITY.md 4.3); responses return what is stored. **Decode those three entities when putting a value into an
  edit field, send the raw text back, and the API escapes it once.** (Web addresses are the exception: `&amp;` in an
  address is decoded before it is saved, so Firebase links keep working.)

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
  "recent": { "orders": [ "5 newest" ], "candles": [ "5" ], "contacts": [ "5" ] }
}
```

Days are Nazareth days (`Asia/Jerusalem`), oldest first, ending today. `revenue` is the sum of order `totalPrice`
(USD) over **all** orders, including ones saved without a verified PayPal payment (filter `status=unverified` in the
list to see those). Orders do not store a price per line, so a product's `revenue` is **units sold x the product's
current price**, an estimate. `lowStock` is tracked stock of 5 or less (at most 20 products, lowest first).

### 4.4 CSV export: `GET /admin/export/orders.csv` (also `candles.csv`, `contacts.csv`)

Editor or owner (it is a bulk copy of personal data). Newest first, at most 10 000 rows, UTF-8 with a byte-order mark so
Excel reads Hebrew and Arabic, `Content-Disposition: attachment`. **Formula injection is neutralised:** a text cell
starting with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe; cells with commas, quotes or
line breaks are quoted (RFC 4180). Stored `&amp;` etc. are decoded to the characters. Each export is audited.

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
| `export.` | `orders`, `candles`, `contacts` (with the row count) |
| `user.` | `create`, `update`, `delete` |

A failed sign-in is recorded with the name that was typed (no account was proven).

## 6. Operations

* **Unlock an account:** an owner re-enables it (`PATCH /admin/users/:id { "disabled": false }`), or wait 15 minutes.
* **Someone lost their authenticator:** an owner sends `PATCH /admin/users/:id { "resetTotp": true }`. If the **only**
  owner lost theirs, remove the three fields by hand in MongoDB
  (`db.admins.updateOne({ username: "..." }, { $set: { totpEnabled: false, totpSecretEnc: null } })`).
* **Rotating `JWT_SECRET`:** all dashboard and old admin tokens stop working (everyone signs in again), and every stored
  TOTP secret becomes unreadable - those users cannot pass the code step (the answer is the same generic `401`, the
  audit log says `totp_secret_unreadable`) until an owner resets their TOTP. Plan the rotation with that in mind.
* **A suspected stolen token:** sign out everywhere by changing the password (all other sessions end) or disabling and
  re-enabling the account (all sessions end). A stolen token cannot change the password (it needs the current one) or
  turn TOTP off (it needs the password and a code); it *could* turn TOTP on for an account that has none, which would
  lock the real user out of password-only sign-in until an owner resets their TOTP; the audit log shows it
  (`auth.totp_setup` / `auth.totp_enable` from an unfamiliar `ua`/`ipHash`).
* **Retention:** audit entries 180 days, sessions until they expire (60 minutes), by TTL indexes (created when the
  server starts; allow MongoDB's TTL monitor up to a minute to purge).

## 7. The old shared-password sign-in is deprecated

`POST /auth/login { password }` (the shared `ADMIN_PASSWORD`) and `POST /admin/login { username, password }` (an
`Admin` account, 8-hour token with no roles, no lockout, no second factor, no audit) are **deprecated**. They keep
working, with a `Deprecation: true` header on their answers, **only so the old admin site keeps running until the new
dashboard is deployed**. The legacy routes they unlock (`/admin/stats`, `/admin/prayers`, `/admin/candles`,
`/admin/products`, `/admin/product-reviews`, `/order/*`, `/candle/*`, `/contact/*`, `/product/*` writes, `/prayer/:id`,
`/review/:id`, `/live/*`) are unchanged; where an address exists in both APIs (`/admin/candles`, ...) a legacy token
gets the legacy answer (a plain array) and a dashboard token gets the new one (`{ items, total, page, size }`).
A legacy token is **not** accepted on the new-only routes, and a dashboard token is not accepted on the legacy-only
ones.

**Retiring them** (once the old admin site is off): delete `POST /auth/login` (`route/authRoute.js`) and
`POST /admin/login` plus the legacy routes in `route/adminRoute.js`; move the remaining `/order`, `/candle`, `/contact`
reads to the dashboard routes; unset `ADMIN_PASSWORD` (and drop it from `REQUIRED_ENV` in `config/env.js`). Until
then the per-address ceiling for `/admin/*` is 1000 requests per 15 minutes (it was the global 200).

## 8. Security model in one page

| Concern | Control |
|---|---|
| Who is calling | personal accounts; bcrypt cost 12; password policy; optional TOTP |
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

## 10. Tests

`server/__tests__/admin-*.test.js` and `totp.test.js`: sign-in, lockout, rate limits, TOTP (RFC 6238 and RFC 4226
vectors, replay), sessions and revocation, password change, the role matrix over every route (every role, no token,
old tokens), lists and pagination bounds, search escaping, order shipping and mail, products validation, CSV
injection, dashboard, users and guards, audit, CORS, headers, error answers, secrets out of logs, the create-admin
script, the models' indexes, and the old admin routes. The database is replaced by an in-memory stand-in
(`__tests__/helpers/fakes.js`); **nothing was run against a real MongoDB** (section 11).

## 11. What is not verified

* No test ran against a real MongoDB or on Render. The fakes understand the operators the routes use; the sanitizeFilter
  test guards the main difference, but compound behaviour (index creation, TTL purge timing, real casting) was not
  observed. Run the first sign-in and one of each change on a staging database before pointing production at it.
* The TTL indexes and the new `Product.category` field are created by Mongoose on first start (`autoIndex`); on Atlas
  check that `auditLog` and `adminSession` show the expiry indexes.
* No e-mail was sent (the mailer is mocked); the shipped-order mail uses the same `sendMail` as before.
