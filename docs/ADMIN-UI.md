# Admin dashboard: screens and behaviour

Code in `admin/` (Next.js 16, TypeScript). How to run, deploy and what protects it: `admin/README.md`.
The API it talks to: `docs/ADMIN.md` (written with the server). Screenshots are taken by
`admin/scripts/screenshots.mjs` against the mock API (Edge, 1366 px and 390 px wide).

## Design

The same night + gold language as the public site (`admin/src/styles/tokens.css` is a copy of the site's tokens;
dark theme only). System fonts, no icon or UI library, no chart library: the charts are small SVG components with a
data table behind each one. Layout uses logical CSS properties, so Hebrew and Arabic mirror correctly (menu on the
right, arrows flipped, numbers and e-mail addresses stay left-to-right). Text lives in `admin/src/i18n/messages`
(English complete; Hebrew and Arabic complete too - a test fails if a key is missing or has different placeholders).

* Keyboard: skip link, visible focus ring, native `<dialog>` for drawers and confirmations (focus trapped, Escape
  closes), the charts move day by day with the arrow keys.
* Phones: the menu becomes a slide-in panel, tables become cards with the column names as labels, no sideways scroll
  from 360 px.
* Every list has loading, empty, no-match and error states; every destructive action asks first; toasts confirm.

## Screens

| Screen | What it does |
| --- | --- |
| **Sign in** | Username + password; a second step appears when the account has two-factor. One message for a wrong user, wrong password or locked account. Show/hide password, Caps Lock hint, rate-limit message, "session ended" / "signed out for inactivity" notices. |
| **Dashboard** | Eight figures (orders, revenue, candle requests, messages, products, site and product reviews, prayers) that link to their lists; orders + revenue and candle charts for 30 days (keyboard readable, data table behind each); top products; low stock; the five latest orders, candle requests and messages. |
| **Orders** | Search, status filter, sort, pagination, CSV export, detail drawer (deep link `?open=`), **Mark shipped** with a confirm dialog (the API e-mails the customer exactly like the old `orderSent`), delete (owner only). |
| **Candle requests / Messages** | Same pattern: search, filter, drawer with the full text, mark done, delete, CSV export; "reply by e-mail" link on messages. |
| **Products** | Table or grid, stock filter, add / edit form with live preview, photo upload to Firebase Storage (REST, no SDK) or a pasted https address, up to 5 extra photos, category override, stock, featured weight, colours; delete. |
| **Reviews** | Site reviews and product reviews in two tabs: hide / show (moderation) and delete. |
| **Prayers** | Search and delete. |
| **Users** (owner) | Create (password policy checked), change role, disable / enable, delete; you cannot touch your own row. |
| **Audit log** (owner) | Who did what, when, from which device (IP only as a salted hash); filter by user and action. |
| **Security settings** | Change password (signs out other sessions); two-factor set-up with a QR drawn in the page (`src/lib/qr.ts`, in-house, decoded by an independent decoder in the tests) or the key typed by hand; turn off with password + code. |
| **Profile** | Account, role abilities, session end time, where the key is kept, sign out. |

![Sign in](admin-ui/login-desktop.png)
![Dashboard](admin-ui/dashboard-desktop.png)
![Orders](admin-ui/orders-desktop.png)
![Order drawer](admin-ui/order-detail-desktop.png)
![Products](admin-ui/products-desktop.png)
![Edit product](admin-ui/product-edit-desktop.png)
![Users](admin-ui/users-desktop.png)
![Audit log](admin-ui/audit-desktop.png)
![Security settings](admin-ui/settings-desktop.png)

On a phone (390 px):

| Sign in | Dashboard | Orders | Products | Users | Audit |
| --- | --- | --- | --- | --- | --- |
| ![](admin-ui/login-phone.png) | ![](admin-ui/dashboard-phone.png) | ![](admin-ui/orders-phone.png) | ![](admin-ui/products-phone.png) | ![](admin-ui/users-phone.png) | ![](admin-ui/audit-phone.png) |

## What each role sees

| | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| Dashboard, lists, detail drawers, CSV export | yes | yes | yes |
| Mark shipped / done, hide reviews, edit products, delete messages, requests, prayers | yes | yes | no (buttons are not shown; the API answers 403 anyway) |
| Delete orders | yes | no | no |
| Users, Audit log | yes | no | no |
| Own password and two-factor | yes | yes | yes |

## Assumptions about the API contract (the server may differ in details)

* Items are Mongo documents with `_id` (or `id`); the UI reads either. Unknown extra fields are ignored; a missing
  field the UI needs becomes one clear "unexpected answer" error, not a broken page.
* `expiresIn` is in seconds (a value above 86,400 is read as milliseconds). The cookie lives that long.
* A product is updated with **PUT** `/admin/products/:id` (as the existing route), body fields `name, price, img,
  additionalImageUrls, description, uuidv4_, rate, color[], stock (null = unlimited), category`.
* List filters: `status` is `pending|shipped` (orders), `pending|done` (candles, contacts), `approved|hidden`
  (reviews), `ok|low|out` (products stock), `active|disabled` (users); `sort` is a field name, `-field` descending.
  Search matches the names, e-mail and text fields. Unknown values must be ignored or answered with 400.
* Candle requests keep their existing DELETE route (the old admin had "Remove"). Product reviews: PATCH
  `{approved}` and DELETE as today.
* Audit entries: `createdAt` (or `at`), `actor` (name or `{username}`), `action`, `target`, `ipHash`, `userAgent`.
* `GET /admin/auth/me` returns `lastLoginAt`; `/admin/users` items return `totpEnabled`, `lastLoginAt`, `disabled`.
* The app forwards the visitor's address in `X-Forwarded-For` and the browser's `User-Agent` (for the audit trail).
* Export is fetched through the proxy as `text/csv` with a `Content-Disposition` filename.
