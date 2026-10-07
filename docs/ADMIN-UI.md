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
| **Sign in** | "Username or e-mail" + password (the first owner's username is his e-mail address); a second step appears when the account has two-factor, with its own heading ("Second step: the code from your app"). **Sign in** is never disabled: an empty field is named in the alert and focused (also on Forgot password). One message for a wrong user, wrong password or locked account. Show/hide password, Caps Lock hint, rate-limit message, "session ended" / "signed out for inactivity" notices, and a **Forgot your password?** link. |
| **Forgot password** (`/forgot-password`, public) | E-mail address, **Send the link**, then always the same neutral confirmation ("If an account uses this address, we sent a link. It works for 30 minutes."), whether or not the address has an account; a link back to sign in. A malformed address is caught before sending; rate-limit and "not available" messages. A signed-in visitor is sent to the dashboard. |
| **Choose a new password** (`/reset-password?token=...`, public, the link from the e-mail) | The token is taken from the address and **removed from the address bar at once** (`history.replaceState`); the page sends no Referer and is not cached. New password + repeat, show/hide, Caps Lock hint, the policy checked before sending and the API's own policy answer translated. Success: a confirmation (every session of the account was signed out) and a **Sign in** button. An invalid, used or expired link, or no link: "This link is invalid or has expired. Ask for a new one." with **Ask for a new link**. Reloading the page after the token was removed shows that message too: open the link from the e-mail again. |
| **Dashboard** | A warning when customers paid but have nothing saved; ten figures (orders, **shop revenue from verified PayPal payments only**, **Payment not verified** (orders saved without a confirmed payment and their amount, not counted in revenue; links to the filtered list), candle requests, messages, products, site and product reviews, prayers, and **Paid, not fulfilled**) that link to their lists; top products show "about $x at today's price" (orders store no line prices); orders + revenue and candle charts for 30 days (keyboard readable, data table behind each); top products; low stock; the five latest orders, candle requests and messages. |
| **Live broadcast** (`/live`, editor and owner) | The studio: **Turn on camera and microphone** (the browser asks; nothing is sent yet), a muted preview (mirrored like a mirror), camera and microphone lists, **Switch camera** (front/back on a phone), **Mute microphone** (`aria-pressed`), a title (1-120 characters), **Go live**: the API prepares a Cloudflare input and the page publishes to it with WebRTC (`admin/src/lib/whip.ts`). While live: a red **Live** badge with the time on air, connection messages (connecting, reconnecting, lost) in a polite live region, **End broadcast** with a confirmation. **The broadcast keeps going on every other dashboard page** (`components/live/LiveBroadcast.tsx` in the layout holds the camera, the WHIP connection, the recorder and the wake lock): a compact bar at the top of those pages shows **Live**, the time on air, the title, the connection state, **Open the studio** and **End broadcast** (confirmed; the camera then turns off), and the recording's upload progress afterwards (`components/live/LiveBar.tsx`). While this tab broadcasts or uploads, the menu opens Live without a reload. Closing or reloading the tab ends the broadcast (a keepalive stop; the browser asks "leave the page?" first); **Sign out** asks first ("You are live. Sign out?") and ends it properly; while the sign-in has ended, links wait (a toast says to sign in again in a new tab first). A broadcast whose camera never reached Cloudflare is listed as **Failed**. "Fulfils scheduled broadcast" offers only announcements within 6 hours of now. The screen is kept on. A broadcast someone else started is shown above the studio; its starter or an owner can end it (an owner confirms ending someone else's). "Not set up yet" when the server has no Cloudflare credentials; clear messages for a refused camera, no camera, a camera in use, an http page. **Record this broadcast** (a switch, on by default, set before going live): the page records what it publishes (`admin/src/lib/recorder.ts`: the picture re-drawn on a canvas and the sound through WebAudio, so switching camera or microphone never stops it; MP4 on Safari, WebM elsewhere, about 2.5 Mbit/s), shows the size recorded so far, and keeps every piece in memory and in IndexedDB (`admin/src/lib/recording-store.ts`; when the device has no room it says to keep the page open). **Fulfils scheduled broadcast**: a list of the waiting scheduled broadcasts, the closest one within two hours chosen already, its title filled in. After **End broadcast** the recording is uploaded straight to Cloudflare (`RecordingUploads.tsx`, `admin/src/lib/recording-upload.ts`, `admin/src/lib/tus.ts`): a progress bar with percentage and MB, announced every quarter, retries after a cut connection, **Retry** when paused, **Discard the recording** (confirmed), a "leave the page?" question while anything is left to send; one upload at a time. A recording left behind by a closed tab or a crash is offered on the next visit: **An unfinished recording was found**, with **Upload the unfinished recording** and **Discard**. **Recordings** (`LiveRecordings.tsx`): picture, title (**Rename** in place), date of the broadcast, duration, status (Uploading, Processing, Ready, Failed with the reason), **On the website** switch (only for a Ready one), **Preview** (Cloudflare's player below the list, loaded only then, focus on its heading, **Close the preview**), **Delete** (confirmed; also at Cloudflare); checked again every 15 seconds while one is uploading or processing; the minutes stored at Cloudflare and their monthly cost, with a warning near the plan's limit. **Scheduled broadcasts** (`LiveSchedule.tsx`): **Schedule a broadcast** (title, date and time in Nazareth time whatever the device's zone, an optional description, **Publish on the website**, a draft when off), then the list (upcoming, live and the last 7 days, soonest first: title, start in Nazareth time and "your time" when different, status Scheduled / Live now / Done / Cancelled / Missed, on the website or not) with **Edit**, **Publish** / **Unpublish**, **Cancel** / **Restore** and **Delete** (confirmed). While on air or uploading, the idle sign-out waits (`admin/src/lib/session-hold.ts`); if the 60-minute sign-in ends meanwhile, the page stays and a notice offers **Sign in in a new tab** (docs/LIVE.md section 5). Below: the 10 most recent broadcasts (title, start, duration, who, how it ended) and the rules (one at a time, recorded only when the switch is on and published only by hand, 6 hours at most, audited). The menu opens this page with a full page load: only this page may use the camera and microphone and connect to Cloudflare Stream (docs/LIVE.md section 3); while this tab broadcasts or uploads it opens it without a reload (the tab's document is already the /live one). |
| **Orders** | Search (also by **order number**: `#0000003f`, `0000003f` or the full id; the number is the same in the list, the drawer, the e-mails and the CSV), status filter, sort, pagination, CSV export, detail drawer (deep link `?open=`; focus returns to the row's link when it closes), **Mark shipped** with a confirm dialog (the API e-mails the customer exactly like the old `orderSent`) and **Undo** in the toast for 10 seconds; an order whose PayPal payment was not verified carries a **Payment not verified** badge in the list and a warning in the drawer, and shipping it asks "PayPal did not confirm this payment" (danger button "I checked PayPal: mark shipped"); **Mark as not shipped** (confirmed) in the drawer; the shipping address one isolated line per part (street with its number, city/state/postal, country) so Hebrew and Arabic never move the house number; **Packing slip** (a new tab: `/print/orders/<id>`, ship-to address in large type, items, colours and quantities, no prices, **Print** with a print stylesheet); delete (owner only). |
| **Payments** | Every PayPal payment the server recorded. Filters: **Paid, not fulfilled** (the customers who paid and have no order or candle request: a warning above the list and on the dashboard), paid, started and not paid, failed, resolved, orders, candles, donations; search by PayPal number, payer or note; detail drawer with the link to the order or candle request; **Mark resolved** (a note is required) and **Reopen**; CSV export of everything or only the unfulfilled. There is no delete. |
| **Candle requests / Messages** | Same pattern: search, filter, drawer with the full text, mark done (**Undo** in the toast; **Mark as not done** in the drawer), delete, CSV export; "reply by e-mail" link on messages (with a subject). |
| **Products** | Table or grid, stock filter, add / edit form with live preview, photo upload to Firebase Storage (REST, no SDK) or a pasted address of a photo **on Firebase Storage** (the only host the website shows: another host is refused with that message, and warned about while typing; a photo already saved stays editable; when upload is not set up the form says so), up to 5 extra photos, category override, stock, featured weight, colours (de-duplicated); delete. The **price** is a text field: "24,50" and "24.50" are both 24.50, a thousands separator or a third decimal is refused, and a price 3x higher or lower than before (or a new one of 1,000+) asks first. **Unsaved changes**: a menu link, Back or Cancel asks "Leave without saving?", closing the tab makes the browser ask; what was typed is kept in this tab (`lib/drafts.ts`) and offered back ("We kept what you typed") after an ended sign-in (the sign-in page returns to the form). The toast after saving says when the website shows it: "now" (the site confirmed its refresh) or "within 10 minutes". A viewer's read-only page shows the category's name, the colours and the photo. |
| **Reviews** | Site reviews and product reviews in two tabs: hide / show (moderation) and delete. |
| **Prayers** | Search and delete. |
| **Users** (owner) | Create (password policy checked, optional **e-mail** for "Forgot your password?"), the e-mail column with **Add e-mail** / **Change e-mail** (also on your own row; "No e-mail" says the reset cannot reach that person), change role, disable / enable, **Locked until hh:mm** instead of Active after 5 wrong passwords with **Unlock**, **Reset two-factor** for an account that has it (confirmed: for a lost phone), delete; you cannot change your own role, state or two-factor here. Form dialogs close on a click outside only while nothing was typed. |
| **Privacy requests** (owner) | Type an e-mail address: how many orders, candle requests, messages, site reviews and payments are stored about it (counts only). **Erase this data** asks for the address again, anonymises orders and candle requests, deletes messages and site reviews, removes the payer's details from payments, and says what it did. Both steps are in the audit log, without the address. |
| **Audit log** (owner) | Who did what, when, from which device (IP only as a salted hash): each action in words ("Marked an order shipped") with its code beside it, a few facts ("e-mail sent", "role: Editor", "120 rows"), the target named ("Order #0000003f", "User staff", "Product Olive cross") and linked when it still exists (`lib/audit-labels.ts`); filter by user and by kind of action (a list). |
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

**When the API is busy or down while the signed-in user is checked** (the layout's `getSession`, which no page's
`error.tsx` can catch), `src/app/(app)/layout.tsx` shows a translated state ("Too many requests. Try again in N minutes." for
a 429, the generic error otherwise) with a retry link, instead of Next's bare error page. E2E: `tests/e2e/busy-api.spec.ts`
(mock control `POST /__mock/busy { count }`).

Every screen is checked from a 320 px phone to a 1920 px screen, at 200% zoom and on a phone held sideways, in
English, Hebrew and Arabic, by `admin/tests/e2e/responsive.spec.ts` (matrix and results: `docs/RESPONSIVE.md`). Its
first run (2026-10-06) found that the phone menu never opened in Hebrew and Arabic, and that product cards, the
top-products list and the charts could be wider than their panels; all fixed.

## Since the review of 2026-10-07 (review 04, and the dashboard items of review 03)

* **A live broadcast survives moving around the dashboard** (above, Live broadcast). Search forms use `next/form`, so
  searching never reloads the page either; `notFound()` inside the dashboard renders in the layout (`(app)/not-found.tsx`).
* **Typed work is not lost**: unsaved-changes question (`components/ui/useUnsavedChanges.ts`), drafts in the tab's
  sessionStorage (`lib/drafts.ts`; dropped after a save, a confirmed Cancel, a manual sign-out or 12 hours), the sign-in
  page returns to the page an ended session left (`next=`), and form dialogs keep their text on a click outside
  (`components/ui/closeOnBackdrop.ts`).
* **Reversible**: "Mark shipped" and "Mark as done" toasts carry **Undo** for 10 seconds (`ApiAction` `undo`, the
  feedback provider's toast action); drawers offer the way back.
* **Focus**: a drawer gives the focus back to the link or button that opened it, or to the row's link when it was opened
  from its address (`components/ui/Drawer.tsx`, WCAG 2.4.3).
* **Right to left**: an address is one isolated line per part; names, product names and amounts are isolated (`<bdi>`,
  `<Money>` keeps an amount left to right: Arabic showed "$US 41.50").
* **Honest about money and the website**: revenue from verified payments only; the product toast says when the website
  shows a change.

## What each role sees

| | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| Dashboard, lists, detail drawers, CSV export | yes | yes | yes |
| Mark shipped / done, hide reviews, edit products, delete messages, requests, prayers | yes | yes | no (buttons are not shown; the API answers 403 anyway) |
| Resolve a payment, export payments | yes | yes | no (read only) |
| Delete orders | yes | no | no |
| Users (with e-mail, Unlock, Reset two-factor), Audit log, Privacy requests | yes | no | no |
| Packing slip of an order | yes | yes | yes |
| Live broadcast: start, end their own | yes | yes | no (no menu entry; the page shows "no access") |
| End a live broadcast someone else started | yes (after confirming) | no | no |
| Upload the recording of a broadcast someone else started | yes | no (only their own; in practice the device that recorded it uploads it) | no |
| Rename, publish, unpublish, delete recordings; schedule, edit, publish, cancel, delete scheduled broadcasts | yes | yes | no |
| Own password and two-factor | yes | yes | yes |

## The contract, as verified against the real API

The dashboard was first built against a mock written from `docs/ADMIN.md`. It was then run, page by page, against
the real API code (`server/test-harness`), which corrected these assumptions. What holds now (each has a test; the
mock and the real API are compared by `admin/tests/unit/parity.test.ts`):

* Items are Mongo documents with `_id`; the UI reads `_id` or `id`. Unknown extra fields are ignored; a missing field
  the UI needs becomes one clear "unexpected answer" error, not a broken page.
* Stored text arrives HTML-escaped (`&amp;`, `&lt;`, `&gt;`): the UI decodes every string it receives once
  (`src/lib/entities.ts`), so forms show what was typed and the API escapes it once more on save.
* `expiresIn` is in seconds (3600). The cookie lives that long.
* Changes answer `{ item }` (orders `{ item, emailSent }`), deletes `{ message }`, creates `201 { item }`. A product is
  updated with PUT or PATCH `/admin/products/:id`; body fields `name, price, img, additionalImageUrls (max 20),
  description, uuidv4_, rate, color[], stock (null = not tracked), category` where `category` is one of eight keys
  (`stained-glass, rosaries, necklaces, bracelets, bibles, crosses, holy-land, gifts`) or null (= from the name), so
  the form offers a choice, not free text. Unknown fields are refused.
* Marking an order shipped e-mails the customer once; the answer's `emailSent` is `true`, `false` (the change is kept,
  the toast says to write to the customer) or `null` (already shipped, nothing sent).
* List filters: `status` is `pending|shipped|unverified` (orders), `pending|done` (candles), `open|done` (contacts),
  `approved|hidden` (reviews), a prayer category, `ok|low|out` (products), `active|owner|editor|viewer|disabled`
  (users); `sort` is a field name, `-field` descending. An unknown status or sort is `400`.
* Every collection has `GET /:id` (the detail drawers open by address). Ids must be 24 hex characters: anything else is
  `400 Invalid id`, which the product page shows as "not found".
* The CSV export is for editors and owners: a viewer gets `403`, so the button is not shown to viewers. Files are
  named `orders-YYYY-MM-DD.csv`; columns are the field names (`id,createdAt,firstName,...`).
* Audit entries: `{ at, actorId, actorName, role, action, target: { type, id }, meta, ipHash, ua, targetName? }`.
* Products answer `siteRefresh` (`done`, `off`, `failed`) after a create, change or delete (docs/ADMIN.md 4.2); a new photo
  must be on `PRODUCT_IMAGE_HOSTS`; a price has at most two decimals. Users take `email` (create and PATCH) and
  `unlock: true`; the list's `lockedUntil` may be in the past. The dashboard's `totals` carry `revenueUnverified` and
  `ordersUnverified`. `POST /admin/live/stop` takes `failed: true`. Orders are searched by their number.
* `GET /admin/auth/me` returns `lastLoginAt`; `/admin/users` items return `totpEnabled`, `lastLoginAt`, `disabled`,
  `lockedUntil`.
* A two-factor code works once and steps only go forward (replay protection): a code just used to set two-factor up
  cannot also sign in within its 30 seconds. The error texts the person can act on are translated by the UI.
* The app forwards the visitor's address (Netlify's header; `X-Forwarded-For` only with `ADMIN_TRUST_XFF=1`) and the
  browser's `User-Agent` for the audit trail.
* Recordings (`/admin/live/recordings`, docs/ADMIN.md 4.6): the list is `{ configured, items, storage }`; `POST` answers
  `201 { recordingId, uploadUrl, recording }` and `409 { error, recording }` when the broadcast already has one (the page
  then asks `/:id/upload-url` for a fresh address); `uploadUrl` is checked on Cloudflare's two upload hosts before use
  (`UPLOAD_URL`, `src/lib/tus.ts`) and never stored; `thumbnailUrl` and `playbackUrl` are used only when they are
  Cloudflare's own addresses. Publishing a recording that is not ready is `409`. The proxy forwards exactly these routes
  (the two `/:id/upload-url` and `/:id/uploaded` are the only four-segment proxy paths, `src/lib/proxy-allow.ts`).
* Scheduled broadcasts (`/admin/live/schedule`): times go in and out as `startsAtLocal` (`YYYY-MM-DDTHH:MM`, Nazareth);
  the API accepts five minutes in the past at most and about a year ahead; changing the time or the status of a live or
  done one is `409`; `POST /admin/live/start` takes an optional `scheduleId` (`404` unknown, `409` not waiting; a busy
  `409` carries `current`, which is how the page tells the two apart).
* The Live page's Content-Security-Policy adds, on `/live` only: `connect-src` `https://upload.videodelivery.net
  https://upload.cloudflarestream.com` (the upload), `frame-src https://*.cloudflarestream.com` (the preview player) and
  `img-src https://*.cloudflarestream.com` (thumbnails), next to the WHIP host it already had.
* Audit actions shown as they are: `live.recording_create`, `live.recording_renew`, `live.recording_uploaded`,
  `live.recording_update`, `live.recording_delete`, `live.recording_status`, `live.recording_failed`,
  `live.schedule_create`, `live.schedule_update`, `live.schedule_delete` (the audit page colours `_delete`, `_create` and
  `failed` like the other actions).
* Not verified without real devices and an account: a real MediaRecorder on iPhone (Safari, mp4) and Android (Chrome,
  webm) through a long broadcast, a camera switch and a locked screen while recording; a real tus upload to Cloudflare
  (its CORS answers, the 5 MiB minimum, an expired address); Cloudflare's thumbnails and player in the preview.
  The end-to-end tests use a fake MediaRecorder and a tus endpoint answered inside the browser
  (`tests/e2e/live-recordings.spec.ts`); `tests/e2e/live.spec.ts` runs the browser's real MediaRecorder through the page's
  mixer with a fake camera.
* Forgotten password (`docs/ADMIN.md` 3.6): `POST /api/session/forgot { email }` answers `202 { ok: true }` for every
  address (`429 { retryAfter }` when limited, `502` when the API cannot be reached); `POST /api/session/reset { token,
  password }` answers `204` (and clears a session cookie this browser still holds, since the API ended every session of
  the account), `400 { error: "link" }` for an invalid, used or expired link, `400 { error: "policy", reason, message }`
  for a password the policy refuses (`reason` is `short`, `long`, `username`, `common`, `repetitive` or null and is
  translated; only an unknown rule shows the API's English text), `429 { retryAfter }`. Both check CSRF, take at most
  2 KB / 4 KB of JSON validated by zod, answer `no-store`, and never log or echo the address, the token or the password.
