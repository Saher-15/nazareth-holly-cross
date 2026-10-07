# Form contracts

Every form of the public site (`web/`) and the dashboard (`admin/`), field by field, against the API route that
reads it (`server/route/`) and the model that stores it (`server/model/`). Audited 2026-10-06 on top of PR #36
(`feat/prayer-country-select`) and PR #37 (`fix/review-place`), which are assumed merged.

**Status**: `OK` the two sides agree; `FIXED` they did not, fixed in branch `fix/form-contracts`; `DOCUMENTED` a
known difference that is harmless or needs a data migration or an owner decision (listed in section 4).

The tests that hold these contracts: `web/tests/unit/form-contracts.test.ts`, `admin/tests/unit/form-contracts.test.ts`
(both import the server's own rules from `server/`), `server/__tests__/form-contracts.test.js`, and the mock/real API
parity test `admin/tests/unit/parity.test.ts`.

## 1. Two rules that apply to every form

**1.1 The sanitiser runs first.** `server/app.js` runs `express-xss-sanitizer` on every request body (except the
admin sign-in, password and user-creation bodies). It writes `&`, `<`, `>` as `&amp;`, `&lt;`, `&gt;` (an entity
already written out is kept), keeps a few harmless tags and strips the rest, **before** the route and the model see
the text. Consequences:

- Lengths are checked on the escaped text: "Tom & Jerry" is 15 characters for the API, not 11. Every form whose
  limit equals the model's now counts the same way: `web/src/lib/formRules.ts` (`storedLength`) and
  `admin/src/lib/entities.ts` (`storedLength`). FIXED.
- An e-mail address with `&` arrives as `a&amp;b@...`, which the API's `isEmail` refuses (`;` is not allowed). The
  forms check the address as the API receives it (`isApiEmail`). FIXED.
- Stored text holds entities, so every reader decodes it once: the dashboard (`admin/src/lib/entities.ts`,
  `decodeDeep`), the CSV export (`server/route/admin/export.js`) and the public site (`web/src/lib/api.ts`). The site
  decoded site reviews and prayers but **not product names, descriptions, colours and product reviews**, which
  showed `Fish &amp; Loaves` (the entity itself) on the shop. FIXED (`web/src/lib/api.ts`).

**1.2 One e-mail rule.** The API checks addresses with `isEmail` (`server/utils/validate.js`: ASCII only, one
mailbox, a dotted domain, at most 254). The forms used the looser `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, which accepts
`anna@exa_mple.com`, `josé@example.com` and `a,b@example.com`. On the checkout and the candle form that refusal came
**after PayPal took the money** (the order or candle could then never be saved). FIXED: checkout, candle, contact
and the dashboard's privacy look-up use the API's own check.

## 2. Public site

### 2.1 Contact (`/contact`, `POST /contact/contact_us_request`)

Client: `web/src/data/pilgrim/contact.ts`, `web/src/components/pilgrim/ContactForm.tsx`. Route:
`server/route/contactRoute.js`. Model: `server/model/contact.js`. Labels: `pilgrim.contact.form.<field>`.

| Field | Client name | Route reads | Model field | Required (client / route / model) | Limits (client / model) | Rule | Status |
|---|---|---|---|---|---|---|---|
| Full name | `fullName` | `fullName` | `fullName` | yes / yes / yes | 2-200 stored / 2-200 | - | FIXED (stored length) |
| E-mail | `email` | `email` | `email` | yes / yes / yes | 254 / 500 | API `isEmail` | FIXED (was the loose pattern) |
| Phone | `phone` (sent only when typed) | `phone` (absent, `null` or `''` = not given; not text = 422) | `phone` | **no / no / no** (default `''`) | 50 / 50 | when given: 5+ digits, `+ ( ) - .` and spaces | OK: optional everywhere since 2026-10-07 (data minimisation, security review 06 finding 8) |
| Message | `msg` | `msg` | `msg` | yes / yes / yes | 3-2000 stored / 3-2000 | - | FIXED (stored length) |

### 2.2 Shop checkout (`/checkout`)

Client: `web/src/app/[locale]/checkout/CheckoutFlow.tsx`, `web/src/components/checkout/validation.ts`,
`web/src/lib/paypal.ts`. Routes: `server/route/orderRoute.js`, `server/services/pricing.js`. Model:
`server/model/order.js`. Labels: `paypalComponent.*`, `checkoutPage.form.*`.

Step 1, `POST /order/create_order` (before paying): `{ type: 'order', items: [{ _id, quantity }] }`. The route reads
`type`, `items[]._id` (or `productID`), `items[].quantity` (whole, 1-50 per line, at most 100 lines; the cart caps a
line at 50, `web/src/lib/cart.tsx`), checks stock, and prices from the database. OK.
Step 2, `POST /order/complete_order`: `{ order_id }`, a 17-character PayPal id. OK.
Step 3, `POST /order/newOrder` (after paying, retried by `web/src/lib/pendingFulfilment.ts`):

| Field | Label key | Client name | Route / model field | Required | Limits (client / model) | Rule | Status |
|---|---|---|---|---|---|---|---|
| First name | `paypalComponent.firstName` | `firstName` | `firstName` | yes / yes | 100 stored / 1-100 | - | FIXED (stored length) |
| Last name | `paypalComponent.lastName` | `lastName` | `lastName` | yes / yes | 100 stored / 1-100 | - | FIXED (stored length) |
| E-mail | `paypalComponent.email` | `email` | `email` (lower-cased) | yes / yes | 254 / 254 | API `isEmail` | FIXED (refused only after paying) |
| Confirm e-mail | `paypalComponent.confirmEmail` | not sent | - | yes / - | - | equal to e-mail, any case | OK |
| Phone | `checkoutPage.form.phone` | `phone` (Arabic-Indic digits sent as 0-9) | `phone` | yes / yes | 50 / 50 | 6-20 digits | OK |
| Country | `checkoutPage.form.country` | `country`: the **English** name of the chosen ISO code | `country` | yes / yes | list / 100 | one of `COUNTRY_CODES` | OK (names with "&" are stored as `&amp;` and decoded by every reader) |
| Street | `paypalComponent.street` | `street` | `street` | yes / yes | 200 stored / 200 | - | FIXED (stored length) |
| City | `paypalComponent.city` | `city` | `city` | yes / yes | 100 stored / 100 | - | FIXED |
| State | `paypalComponent.state` | `state` | `state` | yes / yes | 100 stored / 100 | - | FIXED |
| Postal code | `paypalComponent.postal` | `postal` | `postal` | yes / yes | 20 stored / 20 | text or number | FIXED |
| Lines | - | `products[] { productID, productName, quantity, color }` | `products[] { productID, productName (from the DB), quantity, color (50) }` | yes / 1-100 | quantity 1-50 | - | OK; `productName` sent is ignored (DOCUMENTED) |
| Total | - | `totalPrice` | `totalPrice` computed by the API | - | - | - | DOCUMENTED (sent, ignored) |
| Payment | - | `paypalOrderId` | `paypalOrderId`, `paymentVerified` | yes / optional (`REQUIRE_PAYMENT_PROOF`) | 17 | `^[A-Z0-9]{17}$` | OK |

### 2.3 Prayer candle (`/candle`, `POST /candle/lightACandle`)

Client: `web/src/app/[locale]/candle/CandleFlow.tsx`, `validation.ts`. Route: `server/route/candleRoute.js`. Model:
`server/model/candle.js`. Pays first (`create_order { type: 'candle' }`, fixed price), then saves. Labels `candle.*`.

| Field | Label key | Client name | Model field | Required | Limits (client / model) | Rule | Status |
|---|---|---|---|---|---|---|---|
| Church | `candle.selectChurch` | merged into `prayer` | `prayer` | yes / - | - | `Annunciation church` or `Greek orthodox church` | DOCUMENTED (two facts in one field) |
| First / last name | `candle.firstName`, `candle.lastName` | `firstName`, `lastName` | same | yes / yes | 100 stored / 1-100 | - | FIXED (stored length) |
| E-mail (+ confirm) | `candle.yourEmail`, `candle.confirmEmail` | `email` | `email` (lower-cased) | yes / yes | 254 / 254 | API `isEmail` | FIXED (refused only after paying) |
| Prayer | `candle.yourPrayer` | `prayer` = `"<church>, <prayer>"` | `prayer` | yes / yes | 900 stored (+ church, at most 923) / 5-1000 | - | FIXED (stored length) |
| Payment | - | `paypalOrderId` | `paypalOrderId`, `paymentVerified` | yes / optional | 17 | as 2.2 | OK |

### 2.4 Donation (`/donate`)

Client: `web/src/app/[locale]/donate/DonateFlow.tsx`. Only `POST /order/create_order { type: 'donation', amount,
donorName }`; the donation is recorded in the payment ledger (`server/model/payment.js`), nothing else is saved.

| Field | Label key | Client name | Server field | Required (client / API) | Limits | Status |
|---|---|---|---|---|---|---|
| Name | `checkoutPage.donate.name` | `donorName` | `payment.donorName` (cut at 100) | yes / no | 100 stored / 100 | FIXED (stored length: the API cuts, an "&" could be cut in half) |
| Amount | `checkoutPage.donate.amount` | `amount` (number) | `payment.amount` | yes / yes | 1-5000, 2 decimals / 1-5000 | OK |

### 2.5 Prayer wall (`/prayers`, `POST /prayer/create`, `POST /prayer/like/:id`)

Client: `web/src/data/pilgrim/prayers.ts`, `web/src/components/pilgrim/PrayerForm.tsx`. Route:
`server/route/prayerRoute.js`. Model: `server/model/prayer.js`. Labels `pilgrim.prayers.form.*`.

| Field | Label key | Client name | Model field | Required (client / route / model) | Limits (client / model) | Rule | Status |
|---|---|---|---|---|---|---|---|
| Name | `form.name` | `name` | `name` | yes / yes / yes | 2-100 / 200 | no links, e-mail, tags | OK (client well inside) |
| Country | `form.country` | `country`: English name of the chosen ISO code (PR #36) | `country` | yes / no / **yes** | list / 100 | - | OK (model error is a 400) |
| Category | `form.category` | `category` | `category` | yes / no / default `Personal` | - | `Peace`, `Health`, `Gratitude`, `Family`, `Personal`, `World Peace` | OK |
| Prayer | `form.prayer` | `prayer` | `prayer` | yes / yes / yes | 5-1000 / 2000 | no links | OK (client well inside) |
| Like | heart button | `{}` to `/prayer/like/:id` | `likes` +1 | - | - | 24-hex id | OK |

### 2.6 Site reviews (`/community`, `POST /review/addReview`)

Client: `web/src/components/community/reviewRules.ts`, `ReviewForm.tsx`. Route: `server/route/reviewRoute.js`. Model:
`server/model/review.js`. Labels `pray.*`.

| Field | Label key | Client name | Model field | Required (client / route / model) | Limits (client / model) | Status |
|---|---|---|---|---|---|---|
| Name | `pray.placeholderFullName` | `fullName` | `fullName` | yes / yes / yes | 2-200 stored / 2-200 | FIXED (stored length) |
| Where from | `pray.placeholderCountry` | `place`: English country name (PR #36) | `place` (PR #37; older reviews: `email`) | yes / no / no | list / 200 | OK after #36 + #37 (was: stored in `email`, refused since the e-mail check) |
| Review | `pray.placeholderMessage` | `msg` | `msg` | yes / yes / yes | 3-1000 stored / 3-1000 | FIXED (stored length) |

`GET /review/getReviews` answers `{ _id, fullName, place, email (= place, never an address), msg, createdAt }`;
`web/src/lib/api.ts` `reviewSchema` reads `place`, else `email`. OK.

### 2.7 Product reviews (`/shop/:id`, `POST /product/:id/reviews`)

Client: `web/src/lib/shop/reviews.ts`, `web/src/components/shop/ProductReviewForm.tsx`. Route:
`server/route/productRoute.js` (`REVIEW_FIELDS`). Model: `server/model/productReview.js`. Labels
`shopFeatures.reviews.form.fields.*`.

| Field | Client name | Model field | Required | Limits (client / route) | Status |
|---|---|---|---|---|---|
| Name | `name` | `name` | yes / yes | 2-80 stored / 2-80 | FIXED (stored length) |
| Country ("Country (optional)") | `country` (free text) | `country` | no / no | 80 stored / 80 | FIXED (stored length); DOCUMENTED (free text, unlike prayers and reviews) |
| Stars | `rating` | `rating` | yes / yes | whole 1-5 | OK |
| Title | `title` | `title` | no / no | 120 stored / 120 | FIXED |
| Comment | `comment` | `comment` | yes / yes | 3-1000 stored / 3-1000 | FIXED |
| Honeypot | `website` | - | must be empty | - | OK |

Answers (`GET /product/:id/reviews`, the `201` of the POST): `name country rating title comment createdAt`, read by
`productReviewSchema`, now decoded. FIXED.

### 2.8 Other public POSTs

There is **no newsletter or subscribe form** and no other public POST. Search forms (`/search`, the shop filter) are
local and send nothing. `/live/create_room` and `/live/close_room` are admin-only and have no form in either app.

## 3. Dashboard

The browser calls `admin/src/app/api/proxy/[...path]/route.ts` (allow-list `admin/src/lib/proxy-allow.ts`), which calls
`server/route/admin/*`. Sign-in, forgot and reset go through `admin/src/app/api/session/*`.

### 3.1 Sign-in, forgotten password, reset (`/login`, `/forgot-password`, `/reset-password`)

| Form | Field (label key) | Client / BFF | API (`server/route/admin/auth.js`) | Status |
|---|---|---|---|---|
| Sign-in | `username` (`login.username`) | trimmed, 1-100 | 1-100, a username or the account's e-mail | OK |
| Sign-in | `password` (`login.password`) | 1-200 | 1-200, not sanitised | OK |
| Sign-in | `totp` (`login.code`) | 6 digits (BFF allows 12) | `^\d{6}$`, else 428 | OK |
| Forgot | `email` (`forgot.email`) | loose pattern, 3-254 | always 202 | OK (the answer never depends on the address) |
| Reset | `token` | `^[A-Za-z0-9_-]{43}$` | one-time hash | OK |
| Reset | `password` (`reset.newPassword`) | policy without username | full policy | OK (a username refusal comes back as `reason: 'username'`, translated) |

### 3.2 Account settings (`/settings`)

| Form | Field (label key) | Client | API | Status |
|---|---|---|---|---|
| Change password | `currentPassword` (`settings.currentPassword`) | 1-200 | `secret()` 1-200 | OK |
| Change password | `newPassword` (`settings.newPassword`) | `admin/src/lib/password.ts` | `server/services/passwordPolicy.js` | FIXED (the client lacked the repetitive rule, the username-plus-a-few rule and most of the common list: the admin saw the API's English text) |
| Two-factor | `code` (`totp.code`) | 6 digits | `^\d{6}$` | OK |
| Turn off two-factor | `password`, `code` | 1-200, 6 digits | same | OK |

### 3.3 Users (`/users`, owner)

| Field (label key) | Client | API (`server/route/admin/users.js`) | Status |
|---|---|---|---|
| `username` (`users.username`) | lower-cased, `^[a-z0-9][a-z0-9._-]{2,39}$` | 3-64, `^[A-Za-z0-9][A-Za-z0-9._-]*$`, unique without case | FIXED (a leading `.`, `_` or `-` passed the form and was refused) |
| `password` (`users.password`) | full policy | full policy | FIXED (see 3.2) |
| `role` (`users.role`) | `owner`, `editor`, `viewer` | same enum | OK |
| Role change / disable | `{ role }`, `{ disabled }` | same | OK |
| `resetTotp` | no control | accepted | DOCUMENTED (API only) |

### 3.4 Products (`/products/new`, `/products/:id`)

Client: `admin/src/lib/product-form.ts`, `admin/src/app/(app)/products/ProductForm.tsx`. API:
`server/route/admin/products.js` (`PRODUCT_FIELDS`). Model: `server/model/product.js`.

| Field (label key) | Client name | API / model | Required (create) | Limits (client / API) | Status |
|---|---|---|---|---|---|
| `products.name` | `name` | `name` | yes | 2-200 stored / 2-200 | FIXED (stored length) |
| `products.price` | `price` (number, 2 decimals) | `price` | yes | 0.01-10000 | OK |
| `products.mainImage` | `img` | `img` | yes | https (or http on localhost), no whitespace or quotes, 1000 / http(s), 8-2048 | FIXED (a space or quote passed the form) |
| `products.extraImage` | `additionalImageUrls` | same | no | up to 5 / up to 20 | DOCUMENTED (a product with 6+ extra photos must lose some to be saved) |
| `products.description` | `description` | same | no | 2000 stored / 2000 | FIXED (stored length) |
| `products.category` | `category` (`null` = infer) | same | no | the 8 categories | OK |
| `products.stock` | `stock` (`null` = not tracked) | same | no | whole 0-1,000,000 | OK |
| `products.rate` | `rate` | `rate` (a featuring weight, `featured` in the catalogue) | no | 0-5 | OK; DOCUMENTED (misleading name) |
| `products.colors` | `color[]` (comma separated) | `color[]` | no | 20 x 50 stored / 20 x 50 | FIXED (colours after the 12th were dropped without a word; the limit was 40) |
| (hidden) | `uuidv4_` | `uuidv4_` | no | a UUID / 1-64 | DOCUMENTED (the Firebase photo folder; a new one is made when a product has none) |

### 3.5 Status changes and moderation

| Screen | Request | API | Status |
|---|---|---|---|
| Orders | `PATCH orders/:id { done: true }` (mails the customer once) | `bool()` | OK |
| Candles, contacts | `PATCH .../:id { done: true }` | `bool()` | OK |
| Reviews (site, product) | `PATCH .../:id { approved }` | `bool()` | OK |
| Site reviews list | shows `place`; an older review's `email` that is not an address is shown as the place, never as an e-mail (`admin/src/lib/format.ts`) | `q` searches `place` too | FIXED (API, mock and dashboard) |
| Prayers | delete only | no PATCH | OK |

### 3.6 Payments (`/payments`)

| Field (label key) | Client | API (`server/route/admin/payments.js`) | Status |
|---|---|---|---|
| Resolve `note` (`payments.note`) | required, 1000 stored | required when resolving, 1-1000 after the sanitiser | FIXED (stored length, translated message `payments.errNoteLong`) |
| Reopen | `{ resolved: false }` | same | OK |

### 3.7 Privacy (`/privacy`, owner)

| Field (label key) | Client | API (`server/route/admin/privacy.js`) | Status |
|---|---|---|---|
| `email` (`privacy.emailLabel`) | lower-cased, API `isEmail` | 3-254, `isEmail`, not the erased placeholder | FIXED (was the loose pattern) |
| `confirm` (`privacy.confirmLabel`) | equal to the address, any case | equal after lower-casing | OK |

### 3.8 Responses read by the dashboard and the mock

`admin/src/lib/api.ts` parses every answer; `admin/tests/unit/parity.test.ts` runs one script against the mock
(`admin/mock-api`) and the real API (`server/test-harness`) and compares statuses and shapes. Both seeds now carry
`place` on site reviews (and old reviews with the place in `email`), and both search it. OK. Fields the API sends that
the dashboard does not read (users' `email`, candles' `paypalOrderId`/`paymentVerified`): harmless, DOCUMENTED.

## 4. Documented, not changed

Stored MongoDB fields are never renamed here (that needs a data migration, `docs/DATABASE.md`).

| Model field | What it really holds | Note |
|---|---|---|
| `review.email` | the reviewer's country for reviews before 2026-10-06; no client sends an address | misleading name; `place` replaces it (PR #37) |
| `review.phone` | always `'000'` (the default) | dead: no client has ever sent it |
| `candle.prayer` | `"<church>, <prayer>"` | two facts in one field |
| `order.date` | the same moment as `createdAt` | redundant, set by the API |
| `order.totalPrice`, `order.products[].productName` | computed by the API from the database | the values the site sends are ignored |
| `product.rate` | a featuring weight 0-5, not stars (`featured` in the catalogue) | misleading name |
| `product.uuidv4_` | the Firebase Storage folder of the product's photos | misleading name |
| `contact.phone` | optional on the form, the route and the model (`''` = not given) | label "(optional)" in every language |
| `admin.email` | set only by the owner bootstrap and `server/scripts/create-admin.js`; no dashboard form edits it | no UI |
| `productReview.country` | free text | prayers and site reviews choose from a list since PR #36 |

Open edges, not fixed: a field made only of a tag the sanitiser strips (`<x>`) arrives empty and is refused (all
forms; no real visitor types that); the API cannot look up an e-mail address containing `&` in the privacy tool
(the sanitiser escapes it before `isEmail`).
