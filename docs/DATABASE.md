# The database: collections, indexes, personal data, and how to keep it healthy

MongoDB Atlas holds everything the shop must never lose. This page is the review of that database: every collection and
field, how they relate, which queries need which index (present vs needed), how big it will get, which personal data
is stored where and for how long, and the tools to check and repair it. The code that enforces it is in
`server/model/*.js`; the tools are in `server/scripts/`; the backups are in [BACKUP.md](BACKUP.md).

> Nothing in this review was run against the real Atlas cluster (no database exists on the development PC). Everything
> that the code can prove is covered by tests against the real Mongoose schemas and an in-memory stand-in for the
> driver. What only the real cluster can tell (current index state, sizes, duplicates in old data) is exactly what
> `ensure-indexes.js` (dry run) and `check-data.js` print: run them first (section 10).

## 1. Collections and fields

All collections are in one database (the one named in `DATABASEURL`). `_id` (ObjectId), `createdAt` and `updatedAt`
(Mongoose timestamps) and `__v` exist on every document unless noted. Lengths are enforced **by the schema** (a write
that breaks them is refused with a 400), not only by the routes.

| Collection | Model | Holds | Written by |
|---|---|---|---|
| `order` | Order | A shop order | `POST /order/newOrder` (after payment) |
| `candle` | Candle | A paid request to light a candle | `POST /candle/lightACandle` |
| `payment` | Payment | **The payment ledger**: one row per PayPal order the API created | `create_order`, `complete_order`, `newOrder`, `lightACandle` |
| `contact` | Contact | A message from the contact form | `POST /contact/contact_us_request` |
| `review` | Review | A review of the website | `POST /review/addReview` |
| `productReview` | ProductReview | A star rating and comment on a product | `POST /product/:id/reviews` |
| `prayers` | Prayer | A prayer on the prayer wall | `POST /prayer/create` (likes by `POST /prayer/like/:id`) |
| `product` | Product | A shop product | admin only |
| `admins` | Admin | A dashboard account | the owner, `scripts/create-admin.js` |
| `adminSession` | AdminSession | One sign-in (the session a token needs) | sign-in |
| `auditLog` | AuditLog | Who did what in the dashboard | every admin change |

### order
`firstName` `lastName` (1-100, required), `phone` (<=50, required), `email` (valid address, lower-cased, <=254, required),
`street` (<=200) `city` `state` `country` (<=100) `postal` (<=20) (all required), `totalPrice` (0.01-1,000,000, **always computed by
the server** from product prices, never taken from the browser), `products[]` (1 to 100 lines of `{ productID, productName,
quantity 1-50 whole, color }`), `done` (shipped), `paypalOrderId` (<=40) + `paymentVerified` (PayPal confirmed it was paid in
full for exactly `totalPrice`), `date` (legacy duplicate of `createdAt`), `erasedAt` (set when the customer's personal data was erased).

### candle
`firstName` `lastName` (<=100) `email` (valid, lower-cased) `prayer` (5-1000), `done`, `paypalOrderId` + `paymentVerified` (as order),
`erasedAt`. The prayer text can reveal religious belief: it is treated as sensitive personal data (section 7).

### payment (new)
`paypalOrderId` (**unique**, 10-40), `type` (`order` `candle` `donation` `unknown` = an old client that sent no type), `amount`
(USD, the amount the server asked PayPal for), `currency`, `status` (`created` -> `captured`, or `failed`), `capturedAt`, `payerEmail`
`payerName` (what PayPal says about the payer), `donorName` (what a donor typed; optional), `linkedTo { kind: order|candle, id }` (the saved record this
payment paid for), `resolvedAt` `resolvedBy` `notes` (an admin dealt with it by hand). **A payment is never deleted through the API.**
Section 2 explains the flow.

### contact, review, productReview, prayers
`contact`: `fullName` (2-200) `email` (valid) `phone` (<=50) `msg` (3-2000) `done`.
`review`: `fullName` `email` (optional, valid if given) `phone` (default `000`, legacy) `msg` (3-1000) `approved`.
`productReview`: `product` (ObjectId of the product) `name` (2-80) `country` `rating` (whole 1-5) `title` `comment` (3-1000) `approved`
`ipHash` (a salted hash of the sender's address, `select: false`, never returned).
`prayers`: `name` (<=200) `country` (<=100) `prayer` (<=2000) `category` (one of six) `likes` (>=0).

### product
`name` (2-200) `price` (0.01-10,000) `img` (<=2048) `additionalImageUrls` (<=20) `description` (<=2000) `uuidv4_` (<=64, legacy id from the old admin) `rate`
(0-5, the featuring weight the shop ranks by, **not** stars) `color[]` (<=20) `stock` (whole >=0, or `null` = not tracked) `category` (one of eight, or `null` = infer from the name).

### admins, adminSession, auditLog
`admins`: `username` (unique, <=100) `password` (a bcrypt hash, cost 12) `email` `role` (owner/editor/viewer) `disabled` `failedLogins` `lockedUntil`
`totpSecretEnc` (AES-GCM encrypted, `select: false`) `totpEnabled` `totpLastStep` `lastLoginAt`.
`adminSession`: `sid` (unique) `admin` `expiresAt` (TTL) `revokedAt`.
`auditLog`: `at` `actorId` `actorName` `role` `action` `target {type,id}` `meta` (small, secret-free) `ipHash` (keyed hash) `ua` (browser summary). TTL 180 days.

## 2. The payment ledger (why nothing paid can be lost)

Before this change the browser did three steps and only the last one wrote to the database:

```
browser --> POST /order/create_order      (API asks PayPal for an order)
browser --> PayPal approves, then POST /order/complete_order   (API captures the money)
browser --> POST /order/newOrder  or  /candle/lightACandle       (the ONLY step that stored anything)
```

If the third call failed (offline, tab closed, the API asleep) the customer had paid and the shop had no record. Donations
had no record at all. Now:

| Step | Server (`server/services/payments.js`) | Browser (`web/src/lib/pendingFulfilment.ts`) |
|---|---|---|
| `create_order` | writes a `payment` row `created` (type, server-computed amount, donor name) **before** the PayPal id is handed to the browser; if it cannot, answers 503 and nothing is charged | - |
| `complete_order` | marks the row `captured` (time, payer name and e-mail from PayPal). **Idempotent**: a second call never captures or records twice; a PayPal "already captured" answer is checked and treated as success | asks again (up to 3 times) if the answer was lost, and says "we could not confirm; do not pay again" instead of "you were not charged" |
| `newOrder` / `lightACandle` | accepts the optional `paypalOrderId`, checks the ledger (the payment must be **for that kind of thing**: a donation or a candle cannot pay an order) and PayPal, then links `linkedTo`; the unique indexes stop one payment paying twice | writes the order/candle to `localStorage` **before** the request; retries with a growing delay (2 s ... 15 min) and on every later visit until the API confirms; clears the cart only when the order is confirmed saved |
| later | the dashboard lists every captured payment with no order/candle as **Paid, not fulfilled** (an alert on the dashboard); an admin marks it resolved with a note | shows the customer the reference number (the PayPal order id) if it still fails |

Two facts the design relies on, both tested: (1) the ledger row exists before the customer can pay, so the worst case is a
captured, unlinked row, which is *listed*, not lost; (2) every step is safe to repeat. An old client that does not send
`paypalOrderId` keeps working exactly as before (its order is saved as "unverified"); `REQUIRE_PAYMENT_PROOF=true` makes it
mandatory for orders **and** candles once every client sends it (the new site does).

Not covered, and what covers it: a capture whose answer was lost *and* whose ledger write also failed leaves the row at
`created` while PayPal holds the money. `reconcile-payments.js` lists rows still `created` after 24 h ("check PayPal"); PayPal's own
dashboard is the final source of truth. A customer who paid and never comes back, on a day the API was down, is found by the
dashboard alert and the customer's PayPal receipt.

## 3. Relationships

```
order.products[].productID --------> product._id        (not enforced; the line keeps productName as a snapshot)
productReview.product --------------> product._id        (ref; a deleted product leaves its reviews: check-data lists them)
payment.linkedTo{kind,id} ----------> order._id | candle._id     (set by the API; check-data checks both ends)
payment.paypalOrderId == order.paypalOrderId == candle.paypalOrderId   (a deliberate copy: the proof of payment)
adminSession.admin, auditLog.actorId -> admins._id        (audit rows survive an account's deletion on purpose)
```

MongoDB has no foreign keys. The relationships are kept by the application and **checked by `scripts/check-data.js`**
(orders with unknown product ids, reviews of a missing product, payments pointing at nothing, duplicate payment ids).

## 4. Naming: what is consistent, what is not, and why it stays

* Collections are **singular, lower camel case** (`order`, `productReview`, `adminSession`, `auditLog`, `payment`) because the
  models name them explicitly (`mongoose.model(name, schema, 'order')`).
* **Two are not**: `admins` and `prayers` are plural, because those models were created without an explicit name and
  Mongoose pluralised them. They hold live data. **They are not renamed**: a rename would orphan every account and prayer and
  needs a migration with a rollback plan. The code states it (a comment in `model/prayer.js`, a test pins the names).
* Field names vary by history: `firstName/lastName` (order, candle) vs `fullName` (contact, review) vs `name` (prayer, product review); `msg` vs
  `message`; `done` (shipped/handled) vs `approved` (visible) vs `disabled`; `productID` (order line) vs `product` (review); `uuidv4_` (legacy);
  `date` duplicates `createdAt` on orders; `review.phone` defaults to `000`. They are kept: the public site, the old admin and the
  dashboard read them. **New** collections follow the cleaner rule (`payment`: full words, one meaning per field).
* A rename, if ever wanted, is a three-step change (write both, read both, drop the old) with a backup first.

## 5. Indexes: present vs needed, per query

Indexes are **declared in the models** (`schema.index(...)`), so the code and the database cannot drift unnoticed.
The server **builds the declared indexes when it starts**, in production too (decision of the owner, 06/10; `config/indexPolicy.js`): the database is small, and the unique index on `payment.paypalOrderId` is what makes a duplicate payment registration impossible, so a deploy must not depend on a manual step.
`AUTO_INDEX=false` turns it off (for a large database, where an index build on a live collection is a deliberate act). `node scripts/ensure-indexes.js` shows what is missing (dry run) and creates it only with `--apply`; at start-up the server logs a warning naming any missing index.

| Query (where) | Index it needs | Status |
|---|---|---|
| order by PayPal id (`newOrder` exists-check, admin search) | `paypalOrderId` unique, partial (only strings) | present |
| orders list newest first, CSV export, per-day aggregation, "recent" | `createdAt -1` | present |
| orders pending / shipped, newest first | `done 1, createdAt -1` | **added** (replaces `done 1`) |
| a customer's orders, newest first; a data request | `email 1, createdAt -1` | **added** (replaces `email 1`) |
| candle: one payment lights one candle | `paypalOrderId` unique, partial | **added** |
| candle list / pending / by e-mail | `createdAt -1`, `done 1, createdAt -1`, `email 1` | **added** (`createdAt` present) |
| contact list / open / by e-mail | `createdAt -1`, `done 1, createdAt -1`, `email 1` | **added** (`createdAt` present) |
| public reviews (approved, newest first); admin list; by e-mail | `approved 1, createdAt -1`, `createdAt -1`, `email 1` | **added** |
| prayer wall newest first / by category | `createdAt -1`, `category 1, createdAt -1` | **added** (the wall sorted without an index) |
| product page reviews (product, approved, newest first) | `product 1, approved 1, createdAt -1` | **added** (replaces `product 1, createdAt -1`) |
| review moderation list; catalogue rating aggregation | `approved 1, createdAt -1`, `createdAt -1` | **added** (replaces `approved 1`) |
| product by price / category page | `price 1`; `category 1, price 1` | `price` present; category **added** |
| products featured first, paged (`getNProducts`) | `rate -1, _id 1` (a stable order: ties used to repeat or skip items across pages) | **added** (replaces `rate -1`) |
| products newest first (admin, old list); low / out of stock | `createdAt -1`; `stock 1` | **added** |
| payments: one row per PayPal order | `paypalOrderId` unique | new collection |
| payments list by status / type / newest, "unfulfilled" | `status 1, createdAt -1`; `type 1, createdAt -1`; `createdAt -1` | new collection |
| from an order/candle to its payment; by payer e-mail (data request) | `linkedTo.id 1` sparse; `payerEmail 1` sparse | new collection |
| site search | `name, description` text | present (**no query uses `$text` today**: search is in the browser and a regular expression in the dashboard; it is harmless on a small collection) |
| sign-in; session by id; sessions of an account; expiry | `username` unique; `sid` unique; `admin 1`; `expiresAt` TTL 0 | present |
| audit screen, by actor / action; expiry 180 days | `at -1`; `actorName 1, at -1`; `action 1, at -1`; `at` TTL | present |

What **no index serves** (and why that is acceptable now): the dashboard's search box (`q`, a case-insensitive "contains" over
several fields) scans the collection; `status=unverified` (`paymentVerified != true`) scans; sorting orders by `lastName` or `totalPrice` sorts in memory;
the dashboard's totals and "top products" and the catalogue's "units sold" aggregate **all orders** (cached 30 s and 5 min). With the expected sizes
(section 6) each is a few milliseconds; revisit above about 50,000 orders (a search index, daily totals kept as counters).

`ensure-indexes.js` will also list **EXTRA** indexes no model declares: after this release `order.email_1`, `order.done_1`, `product.rate_-1`,
`productReview.product_1`, `productReview.approved_1`, `productReview.product_1_createdAt_-1`, `review.approved_1` and the old single-field
`candle`/`contact` ones are redundant (the new compound indexes serve their queries). They are only dropped with `--prune`, after you are happy.

## 6. Growth and size (estimates, unverified: read the real numbers in Atlas -> Collections)

| Collection | Document | Growth (a busy shop) | After 5 years |
|---|---|---|---|
| order | about 1.2 KB | 1,000 a year | about 6 MB |
| candle | about 0.7 KB | 3,000 a year | about 10 MB |
| payment | about 0.5 KB | 5,000 a year (every attempt creates a row) | about 12 MB |
| contact / review / productReview / prayers | 0.3-0.5 KB | a few thousand a year | a few MB each |
| product | 1-2 KB | a few new ones | under 1 MB |
| auditLog | about 0.4 KB | 180 days kept: a few thousand entries | constant |
| adminSession | 0.15 KB | expires after 60 minutes | constant |

The whole database (about 84 KB on 2026-10-06, on an M10 cluster with Cloud Backup: INFRASTRUCTURE.md 6.1) stays tiny for
many years; size is not the limit that matters. Everything that reads "all" documents is capped:
the old admin routes `getAllOrders`, `getAllCandleRequests`, `get_all_contact_us`, `getAllProducts` and `/admin/{prayers,candles,products}` now return at most
5,000 documents, newest first, as the same plain array, with an `X-Result-Capped: 5000` header when the cap was reached (`utils/pagination.js`). The
dashboard's lists are paginated (at most 100 a page, 10,000 for a CSV export), and hot reads use `.lean()` and field lists
(the catalogue reads only the product fields it shows).

## 7. Personal data: what is stored where

| Where | Personal data | Purpose |
|---|---|---|
| `order` | name, e-mail, phone, postal address | ship the order, tell the customer |
| `candle` | name, e-mail, **prayer text (religious belief: sensitive)** | light the candle, send the video |
| `contact` | name, e-mail, phone, message | answer the message |
| `review` | name, optional e-mail, phone (default `000`), review text | publish the review (name and text are shown publicly once approved) |
| `productReview` | a first name, country, text; a salted hash of the IP address | publish the review; spot abuse |
| `prayers` | a name, country, **prayer text (sensitive)** | the public prayer wall (public by design) |
| `payment` | payer e-mail and name (from PayPal), donor name | the shop's record of money received |
| `admins` / `auditLog` / `adminSession` | staff username, e-mail; keyed hash of the address and browser summary | accounts and accountability (staff) |
| The customer's browser (`localStorage`, key `nhc.pending-fulfilment.v1`) | the whole order or candle request until it is confirmed saved, **at most 30 days** | not losing a paid order |
| Backups | **everything above**, plus the admin accounts' hashes | recovery (BACKUP.md): keep them private; they age out after 30 days |
| PayPal, Netlify, Render, Firebase, the mailbox | their own copies (card data is only ever at PayPal) | outside this database |

Card details are never seen or stored. IP addresses are never stored in readable form (only keyed or salted hashes).

### Proposed retention (the owner and the accountant decide; this is not legal advice)

| Data | Keep | Then |
|---|---|---|
| Orders and payments | the period tax law requires for sales records (commonly 7 years in Israel: confirm with the accountant) | anonymise the person's details (as "erase" does), keep the sale |
| Candle requests | 2 years | anonymise |
| Contact messages | 12-24 months after the last reply | delete |
| Site and product reviews, prayers | until the person asks, or the owner removes them | delete (a prayer or review the person asks to remove is a deletion request) |
| Dashboard audit entries | 180 days (automatic: TTL index) | expire |
| Sessions | 60 minutes (automatic: TTL index) | expire |
| Backups | 30 days (the Windows task) | rotate |

Only the last three are automatic today. The others are a **procedure**: nothing deletes a customer record by itself (a mistake
in an automatic purge would be worse than keeping it). A scheduled "anonymise orders older than N years" job can be added when the
owner has decided the periods; until then, section 8 is the tool.

## 8. Erasing a customer (a data-protection request)

Dashboard -> **Privacy requests** (owners only; API `POST /admin/privacy/lookup` and `/erase`):

1. Type the person's e-mail address -> **Find**: counts of what is stored (orders, candle requests, messages, site reviews, payments). No personal data is shown.
2. **Erase this data** -> type the address again to confirm. Then:
   * **orders and candle requests** are *anonymised*, not deleted: the sale stays in the shop's accounts, but name, address, phone, e-mail (and a candle's prayer text) are replaced by "Erased", and `erasedAt` is set;
   * **messages** and **site reviews** with that address are deleted;
   * **payments**: the payer's e-mail and names (and the donor name) are removed; the amount and PayPal number stay (accounts);
   * product reviews and prayers hold no e-mail address, so they cannot be found by one: if the person wants a prayer or product review removed, find it in Prayers / Reviews by its text and delete it.
3. Every look-up and erasure is written to the audit log (`privacy.lookup`, `privacy.erase`) with the counts and a **keyed hash** of the address, never the
   address itself (that would keep the data for another 180 days). The log entry shows *that* a request was handled and by whom.

After a **restore** from a backup, erasures made since the backup are undone (the backup still holds the data). Keep your own
list of requests (date, who, what was done: *not* the personal data) and repeat each one on the restored database.
Backups also hold the data until they age out (30 days): tell the person it leaves the backups within that time.

## 9. Writes: validation, uniqueness, and why there are no transactions

* **Every write is validated by its schema** (types, min/max, lengths, enums, formats), on top of the route's own checks: a test fails if any
  text field of any model is unbounded or any number has no bound (`__tests__/database-models.test.js`). Updates made through `findByIdAndUpdate` run
  validators where the admin API uses them (`runValidators: true`).
* **Unique where a duplicate is harmful**: `payment.paypalOrderId`; `order.paypalOrderId` and `candle.paypalOrderId` (only for documents that have one, because
  older clients save orders without it); `admins.username`; `adminSession.sid`. A duplicate is refused with 409.
  Account names that differ only by case are refused by the API, not by an index (a case-insensitive unique index would fail to build if two such names ever existed; `check-data.js` reports them).
* **No transactions, on purpose.** Every business write is a single-document write, and MongoDB makes those atomic. The two-step sequences (a ledger row,
  then the order; the order, then the link) are written so each step is safe to repeat and the order of steps means a failure leaves a *listed* state
  (a captured, unlinked payment), never a lost one. A transaction would not help the real failure, which is the *browser* between two separate HTTP requests,
  and would add a replica-set requirement, latency and retries for no gain.
* Stock is checked when an order is **priced** but is not decremented: the shop treats stock as a display figure the admin keeps. (If stock must become exact,
  a conditional `findOneAndUpdate({stock: {$gte: n}}, {$inc: ...})` per line is the single-document tool for it.)

## 10. The tools

All of them take the address from `DATABASEURL` (environment or a hidden prompt, never an argument) and print only the host and database name.

| Command (in `server/`) | Changes anything? | Use |
|---|---|---|
| `node scripts/ensure-indexes.js` | no (dry run) | lists the indexes it would create, and conflicting or extra ones |
| `node scripts/ensure-indexes.js --apply` | **indexes only** | creates the missing ones. Never touches documents. `--replace-conflicts` drops a differing index and creates the model's; `--prune` drops indexes no model declares |
| `node scripts/check-data.js [--json]` | no | structural problems: schema failures (missing field, bad enum, out of range, wrong type, bad e-mail), orders with unknown products, reviews of a missing product, negative stock, duplicate PayPal ids, payments pointing at nothing, duplicate account names. Prints ids and field names, never customer data. Exit code 1 if anything is found |
| `node scripts/reconcile-payments.js [--since DATE]` | no | paid-but-unfulfilled payments, dangling links, stale `created` rows, orders without a payment id after the cut-over |
| `node scripts/backup.js --out <folder>` / `restore.js` | no / only into an empty database | [BACKUP.md](BACKUP.md) |

### Rolling this release out (in this order)

1. **Take a backup first** (`backup.js`), and keep the folder.
2. `check-data.js` on production: read the baseline. Old data may fail the **new, stricter** schema (for example orders saved without a phone number): that matters only when such a
   document is *saved again* through Mongoose (the old admin's product edit does a full save). Nothing else reads the schema.
3. `ensure-indexes.js` (dry run), read the list, then `ensure-indexes.js --apply`. **Before the deploy**: the new code expects the unique `payment` index and the production server will not build it by itself.
4. Deploy the API (merge to `main`; Render redeploys). Old clients keep working. Then the website, then the dashboard.
5. `reconcile-payments.js` the next day and weekly; `check-data.js` monthly.
6. After a week without trouble: `ensure-indexes.js --prune` to drop the redundant old indexes.

## 11. Not verified

* Nothing was run against a real MongoDB or Atlas (index creation on real data, TTL timing, the exact text-index specification Atlas reports, real duplicate or malformed old
  documents). The comparison of declared and actual indexes was tested against a stand-in that mimics what MongoDB reports; the first real dry run is the real test.
* The estimates in section 6 are not measurements.
* The retention periods in section 7 are proposals.
