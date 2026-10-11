# Admin dashboard: runbook

How to run the new admin dashboard locally, create the first owner, configure Render and Netlify, deploy it, roll it
back, and what to check before the owner starts using it. The pieces: the dashboard (`admin/`, Next.js), the API
(`server/route/admin/*`, [ADMIN.md](ADMIN.md)), the screens ([ADMIN-UI.md](ADMIN-UI.md)).

> **Hosting since 2026-10-07: the API runs on Railway, not Render** (project `divine-spontaneity`, service
> `nazareth-holy-cross-api`, built from this repository, root `/server`; address
> `https://nazareth-holy-cross-api-production.up.railway.app`). The Render service is suspended. Where this page
> still says Render, read it with this table (checked read-only on 2026-10-10):
>
> | On Render it was | On Railway it is |
> |---|---|
> | Environment -> variables | the service -> **Variables** (same names; a change redeploys) |
> | Auto-deploy of `main` | the same: Railway deploys `main` (root `/server`) after a merge |
> | Logs, Events | the service -> **Deployments** -> a deploy -> Logs (`railway logs`) |
> | Rollback | **Deployments** -> the previous successful deploy -> **Redeploy** |
> | Free plan sleeps after 15 minutes | it does not sleep unless "Serverless" is switched on in the service settings (not checked from here) |
> | Oregon, behind Cloudflare | Railway's own edge (`x-railway-edge`), one proxy hop: `TRUST_PROXY` is unset (default 1) |
> | `render.yaml` | kept for reference only; Railway reads its own service settings |
>
> Hermes (the 24/7 watcher, [MONITORING.md](MONITORING.md)) runs on the same Railway project.

```
browser --httpOnly cookie--> dashboard (admin/, Netlify) --Bearer token, server to server--> API (server/, Railway) --> MongoDB
```

## 1. Run it on your PC

Two ways, both with no database and no secrets. Ports used below: dashboard 3911, API 3912 (any free ports work).

**A. Against the real API code, in memory (the harness).** This is the one to use to see what production will do.

```powershell
# terminal 1: the REAL Express API over in-memory data, mail recorded instead of sent, throw-away secrets
cd server
node test-harness/serve.mjs                    # http://127.0.0.1:3912   (same as: npm run harness)

# terminal 2: the dashboard
cd admin
npm ci                                         # once
$env:SWC_NATIVE_BINDING_CACHE = "C:\Users\saher\nhc\.swc-cache"   # this PC only, for Next builds
$env:TURBOPACK_ROOT = "C:\Users\saher\nhc"                        # only when node_modules is a junction
$env:ADMIN_API_URL = "http://127.0.0.1:3912"
npm run build; npx next start -p 3911          # or: npm run dev -- -p 3911
```

Open <http://localhost:3911/login>. Accounts (public, in-memory only, listed in `server/test-harness/README.md`):
`owner` / `Owner-Mock-Pass-1`, `editor` / `Editor-Mock-Pass-1`, `viewer` / `Viewer-Mock-Pass-1`, and `secure` /
`Secure-Mock-Pass-1` with two-factor (secret `JBSWY3DPEHPK3PXP`). `POST http://127.0.0.1:3912/__harness/reset` puts
everything back; `GET .../__harness/emails` shows the mails it "sent". It reads no `.env`, opens no connection to any
real service and stops everything when you close it.

**B. Against the mock of the contract.** `cd admin; npm run dev:mock` (port 3902), then the dashboard with
`ADMIN_API_URL=http://127.0.0.1:3902`. Same accounts. The mock answers exactly like the real API (a parity test
compares them), it is just quicker to start.

Tests: `cd admin; npm run check` (lint, types, unit, build), `npm run test:e2e` (mock) and `npm run test:e2e:harness`
(real API code); `cd server; npm test`. Security probes: `node scripts/probe-api.mjs`, `node scripts/probe-bff.mjs`
(harness and dashboard running). Set `PW_CHANNEL=msedge` to reuse the installed Edge.

## 2. Create the first real owner (production)

Nobody can sign in to production until an owner exists. **The password is chosen by the owner himself, on his own
device, so no one else ever sees it.**

**Recommended: by e-mail (no terminal, no database access).** It works only while the database holds **no admin account
at all**, and only for the address in `ADMIN_BOOTSTRAP_EMAILS` (default `nazarethholycross@gmail.com`); the API and the
dashboard must already be deployed, and the API's mail settings (`MAIL_FROM`, `MAIL_APP_PASSWORD`) must work.

1. Open <https://admin.nazarethholycross.com/forgot-password> (or **Forgot your password?** under the sign-in form).
2. Enter `nazarethholycross@gmail.com` and press **Send the link**. The page always answers the same neutral sentence.
3. Open the mail "Nazareth Holy Cross dashboard: choose your password" in that mailbox (look in spam too) and open the
   link within 30 minutes. It works once.
4. Choose the password (12+ characters, not a common one), typed twice. Then sign in with the username
   `nazarethholycross@gmail.com` and that password.
5. Open **Security settings** and turn on two-factor sign-in with an authenticator app. Then create the other accounts
   under **Users** (one per person, `editor` or `viewer`).

The link goes to `ADMIN_APP_URL` (Render; default `https://admin.nazarethholycross.com`): if the dashboard lives
elsewhere, set `ADMIN_APP_URL` first. From then on the same page resets the password of any account that has an e-mail
address (or an e-mail address as its username). Nothing is created once one account exists; to turn the e-mail route to
a first owner off entirely, set `ADMIN_BOOTSTRAP_EMAILS=` (empty) on Render.

**Fallback: from a terminal** (the mail does not arrive, or another username is wanted). An owner can always be created
this way; do it on the owner's own computer, typing the password himself.

1. `git clone` the repository (or use the existing folder), `cd server`, `npm ci`.
2. Create `server/.env` containing ONLY the production connection string (never commit it, delete it afterwards):
   `DATABASEURL=mongodb+srv://...` (Render dashboard -> the API service -> Environment, or Atlas -> Connect).
3. `node scripts/create-admin.js`. It prints the database host and name (check it is the production cluster), asks
   for a username and a password (typed twice, hidden; 12+ characters, not a common one) and creates an **owner**. It
   refuses arguments and refuses to run without an interactive terminal; the password never touches a file.
4. Delete `server/.env`. Sign in at the dashboard, open **Security settings** and turn on two-factor sign-in with an
   authenticator app. Then create the other accounts under **Users** (one per person, `editor` or `viewer`).

If the only owner loses the authenticator: ADMIN.md section 6 (`db.admins.updateOne(...)` in Atlas).

## 3. Environment variables

**Render (the API, service `nazareth-holy-cross-api`)** - nothing new is required for the dashboard:

| Variable | Value |
|---|---|
| `JWT_SECRET` | already set (32+ random characters). Signs the dashboard tokens and encrypts the TOTP secrets: rotating it signs everyone out and makes stored second-factor secrets unreadable (ADMIN.md 6). |
| `DATABASEURL` | already set. New collections `adminSession`, `auditLog` appear on first use; check in Atlas that both have their TTL index. |
| `ADMIN_ORIGINS` | optional here: the exact origin of the dashboard, e.g. `https://admin.nazarethholycross.com`, no trailing slash. The dashboard calls the API from its server, so CORS is not involved; this only matters if a browser ever calls the API directly. (The old `nazaretholycrossadmin.netlify.app` addresses are no longer trusted.) Set it to the final domain anyway, so it is right the day it is needed. |
| `ADMIN_PASSWORD` | **no longer used: delete it.** The legacy shared-password sign-in was removed on 2026-10-07 (ADMIN.md 7); the server neither requires nor reads it, and while it is still set the start-up log says "ADMIN_PASSWORD is set but no longer used". Render -> the service -> **Environment** -> delete `ADMIN_PASSWORD` -> Save (a redeploy follows; nothing else changes). **Do not touch `JWT_SECRET`.** |
| `ADMIN_APP_URL` | optional: the dashboard's address, used in the password-reset e-mail (`<ADMIN_APP_URL>/reset-password?token=...`). Default `https://admin.nazarethholycross.com`; set it when the dashboard gets its own domain. |
| `ADMIN_BOOTSTRAP_EMAILS` | optional: who may create the first owner by e-mail while no account exists (section 2). Default `nazarethholycross@gmail.com`; empty turns it off. |
| `MAIL_FROM`, `MAIL_APP_PASSWORD` | already set: the password-reset mails use them. |
| `CF_ACCOUNT_ID`, `CF_STREAM_API_TOKEN` | optional: live broadcasting from the dashboard's Live page through Cloudflare Stream. Set up and first test: [LIVE.md](LIVE.md) sections 6 and 7. Without them the Live page says "not set up yet". New collection `liveSession`. |
| `REVALIDATE_SECRET` | optional (recommended): a long random value (32+ characters, e.g. `openssl rand -base64 32`), **the same value** also on the **website's** Netlify site (not the dashboard's). Then a product saved in the dashboard is on the website at once; without it, within 10 minutes. ADMIN.md 4.2. |
| `SITE_URL`, `PRODUCT_IMAGE_HOSTS` | optional: where the refresh above goes (default `https://nazarethholycross.com`) and the hosts a product photo may be on (default `firebasestorage.googleapis.com`, the only one the website shows). |

**Netlify (the admin site)**:

| Variable | Value |
|---|---|
| `ADMIN_API_URL` | `https://nazareth-holy-cross-api-production.up.railway.app` (the API origin, no trailing slash). Server-side only; never prefixed `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (+ the other `NEXT_PUBLIC_FIREBASE_*` in `admin/.env.example`) | optional: turns on product-photo upload. Public values, not secrets. Empty = the form asks for pasted https image addresses. |
| `ADMIN_IMG_SRC` | optional: extra https image hosts for the Content-Security-Policy. |
| `ADMIN_TIMEZONE` | optional, default `Asia/Jerusalem`. |
| `ADMIN_TRUST_XFF` | leave unset on Netlify (its own client-address header is used). |
| `ADMIN_ALLOWED_ORIGINS` | leave unset unless the dashboard is reached through a second domain. |

No secret belongs in `admin/netlify.toml` or in the repository.

**Netlify (the website, `web/`)**: `REVALIDATE_SECRET`, the same value as on Render (above). Without it the website's
`/api/revalidate` answers 404 and nothing else changes.

## 4. Deploy the dashboard (Netlify)

**Live since 2026-10-06:** the new dashboard is the Netlify site `nhc-admin-dashboard` (base `admin`) at
**https://admin.nazarethholycross.com** (Netlify DNS, Force HTTPS on); `https://nazarethholycross.com/admin` and the
`netlify.app` address forward there. The steps below describe the older plan of re-linking the 2024 site
`nazaretholycrossadmin` and are kept for reference; that old site still serves the 2024 admin until it is retired.

The dashboard is its **own Netlify site**, `nazaretholycrossadmin`, never the public site. That site is currently
connected to the OLD admin repository; point it at this repository instead.

1. **Before touching the site**, check the code: `cd admin; npm run check` and both e2e runs are green, and the
   branch is merged to `main` (or use the branch for a preview first, below).
2. Netlify -> site `nazaretholycrossadmin` -> **Site configuration -> Build & deploy -> Continuous deployment ->
   Repository -> Link to a different repository** -> GitHub -> `Saher-15/nazareth-holly-cross`. (Netlify asks to
   authorise the GitHub app for that repository if it never did.) The old repository is left as it is.
3. **Build settings** on the same page (they must match `admin/netlify.toml`, which Netlify reads from the base
   directory):
   * Base directory: `admin`
   * Build command: `npm run build`
   * Publish directory: `.next`
   * Production branch: `main`; Deploy previews: any pull request.
4. **Runtime**: nothing to install by hand. `admin/netlify.toml` names `@netlify/plugin-nextjs` (the official Next.js
   runtime) and `NODE_VERSION = "22"`. Without that plugin Netlify builds "successfully" and then answers 404 on every
   page, which is exactly how the public site broke once. Under **Plugins** (or the first deploy log) confirm
   "Next.js Runtime" ran.
5. **Environment variables**: section 3 (Netlify). Save them before the first build.
6. Trigger a deploy from a branch or a pull request first: the **deploy preview** of that change is the test bed.

### THE RULE: the deploy preview must answer HTTP 200 on `/login` before merging

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<preview-url>/login          # must print 200
curl -s -o /dev/null -w "%{http_code}\n" https://<preview-url>/robots.txt     # must print 200
curl -sI https://<preview-url>/login | grep -i -E "content-security-policy|strict-transport|x-frame|cache-control"
```

Then in a browser on the preview: sign in with the real owner (section 2), check the cookie in the developer tools is
`__Host-nhc_admin`, `Secure`, `HttpOnly`, `SameSite=Strict`, open every page, mark nothing important. A `404` on
`/login`, or no CSP header, means the runtime plugin did not run: do not merge.

7. Merge (with the owner's approval) -> production deploys. Add the custom domain (HTTPS) under **Domain
   management**, then put that exact origin into Render's `ADMIN_ORIGINS`.
8. The API's legacy sign-ins and routes are already removed (ADMIN.md 7). What is left for the owner: delete
   `ADMIN_PASSWORD` on Render (section 3), and unpublish the old Netlify site `nazaretholycrossadmin` or make it redirect
   to the dashboard (it still serves the 2024 page, wired to a Heroku app that no longer exists).

## 5. Roll back

* **Dashboard**: Netlify -> Deploys -> pick the last good deploy -> **Publish deploy**. Then revert the bad commit on
  `main` with a pull request. To go back to the old admin repository entirely: Continuous deployment -> Link to a
  different repository -> the old one, and restore its old base directory and build command (write them down before
  step 2 of section 4: Netlify shows them on that page).
* **API**: Render -> the service -> Rollback to the previous deploy. Rolling back past 2026-10-07 brings the removed
  legacy sign-ins back (and, while `ADMIN_PASSWORD` is deleted, that older API refuses to start: put it back first). Prefer
  fixing forward with a pull request.
* **A suspected stolen session**: change the password or disable and re-enable the account (all its sessions end at
  once); for everyone, rotate `JWT_SECRET` (ADMIN.md 6).

## 6. Pre-launch checklist

- [ ] `server`: `npm test` green. `admin`: `npm run check`, `npm run test:e2e`, `npm run test:e2e:harness` green.
- [ ] Staging (or one careful production pass) with a real MongoDB: sign in, one change of each kind, a CSV export,
      shipping an order e-mails the customer exactly once. **No test has run against a real MongoDB or on Render yet.**
- [ ] The first owner created by the owner himself (section 2: the e-mail link, or the terminal on his own machine);
      two-factor on for every account; no shared accounts.
- [ ] Atlas: `adminSession` and `auditLog` have their TTL indexes; the `admins` collection holds only real people.
- [ ] Render: `JWT_SECRET` is 32+ random characters; `ADMIN_PASSWORD` deleted; `ADMIN_ORIGINS` set to the final domain.
- [ ] Netlify: `ADMIN_API_URL` set; the deploy preview answered 200 on `/login` and `/robots.txt`; CSP and cookie flags
      checked (section 4).
- [ ] Firebase Storage rules: the old admin wrote to the bucket without signing in. Restrict writes (signed-in only, image
      types, a size limit) before enabling upload, or leave the upload variables empty and paste image addresses.
- [ ] A phone and a desktop look at every page (and Hebrew, Arabic once).
- [x] The old admin site's API routes and sign-ins are removed (2026-10-07). - [ ] Unpublish the old Netlify site itself.

## 7. Day to day

Unlock an account (5 wrong passwords: the Users page says "Locked until hh:mm"): an owner presses **Unlock**. Lost
authenticator: an owner presses **Reset two-factor** on the Users page (after making sure it is really that person, for
example by phone). Forgotten password: "Forgot your password?" on the sign-in page works for an account that has an
e-mail address; an owner adds it on the Users page (the **Recovery e-mail** column, **Change**; give every account one). Someone leaves: disable (not
delete) the account; the audit log keeps who did what for 180 days. Rotating `JWT_SECRET` and the retention of
sessions: ADMIN.md 6.

**Live broadcast and the rest of the dashboard.** While broadcasting, the other pages can be used (a bar at the top shows
the broadcast and ends it). Do not close or reload the broadcasting tab, and do not sign out in it: that ends the
broadcast. To print a parcel's address: the order's drawer -> **Packing slip** (a new tab).

**The website after a product change.** With `REVALIDATE_SECRET` set on Render and on Netlify (the same value, section
3), the dashboard says "It is on the website now" after saving a product; without it, "within 10 minutes".

### 7.1 Payments, backups and the database tools

* **Every week**: dashboard -> Payments -> filter *Paid, not fulfilled* (also the warning on the dashboard). A row there is a customer who paid and has nothing saved: write to them (the payer's
  e-mail is in the drawer), put it right (enter the order by hand, or refund in PayPal), then **Mark resolved** with a note saying what you did. `node scripts/reconcile-payments.js` (in `server/`) is the same
  report for a terminal, plus payments that were started and never captured (check PayPal for those).
* **Every day, automatically**: the backup (docs/BACKUP.md). Look at `LAST_OK.txt` in the backup folder once a week. Test a restore once now and every few months.
* **Every month**: `node scripts/check-data.js` (structural check, read-only) and `node scripts/ensure-indexes.js` (dry run: must say every index exists).
* **A person asks for their data to be erased**: dashboard -> Privacy requests (owner), docs/DATABASE.md section 8. Type
  their e-mail address and, to include prayers and product reviews, the name and the country exactly as
  published. After the erase the page lists what it could **not** erase: delete their mails in Gmail's Sent folder, note
  when the last backup with their data expires (30 days), check recordings, and tell them what remains.
* **Deploying the release that added the ledger**, in this order: backup; `check-data.js`; `ensure-indexes.js --apply` (creates the unique `payment.paypalOrderId` index, because the production server no longer builds indexes by itself);
  merge (the API first, then the website, then the dashboard: old clients keep working at every step); look at Payments the next day. Details: docs/DATABASE.md section 10.

## 8. What running the two halves together found (all fixed, each with a regression test)

The dashboard (built against a mock from the written contract) and the API (built from the same contract, 732 tests)
had never run together. Run through `server/test-harness`, they disagreed on:

| Mismatch | Fixed on | How |
|---|---|---|
| Dashboard's recent candles and messages failed its own schema (the API sent only a few fields): the whole dashboard showed an error | API | `services/dashboard.js` selects `email, prayer` / `msg`; test in `admin-resources.test.js` |
| The detail drawers of candles, messages, reviews and prayers called `GET /:id`, which only orders and products had (404) | API | `GET /:id` on every collection (viewer); tests |
| Filters the UI offered and the API refused (400): messages `pending`, products `ok`, users `active` | both | UI uses `open`; API accepts `ok` and `active`; the orders list also got its `unverified` filter; tests |
| Audit log: the API names the fields `at`, `actorName`, `ua`, `target:{type,id}`; the UI read `actor`, `userAgent`: every row showed no user and no device | UI | schema reads the real names; unit test |
| Stored text is HTML-escaped (`&amp;`): shown raw, and re-escaped on every edit | UI | decoded once on receipt (`lib/entities.ts`); unit and e2e tests |
| Product category was free text; the API accepts eight keys or null (create always failed) | UI | a select with the eight categories; unit tests |
| Viewers saw an Export CSV button; the API (rightly: bulk personal data) answers 403 | UI | button only for editor and owner; e2e tests (UI hides, API refuses) |
| `emailSent: false` after shipping was never shown | UI | its own toast; e2e test with the mailer failing |
| A bad product id (400) showed an error instead of "not found" | UI | 400 and 404 both give not found |
| The two-factor and password errors were the API's English text | UI | translated for the cases a person can fix |
| Tests assumed the mock's quirks: `localhost:3901`, CSV file name `orders.csv` and quoted header, the lockout visible behind the rate limit, a code usable twice | tests | the suite now runs unchanged on both backends |
| The mock differed from the API in almost every response shape (bare documents, 204 deletes, status codes, filters, audit fields, guards) | mock | rewritten to the real contract; `tests/unit/parity.test.ts` runs one script on both and fails on any difference in status or shape |

## 9. Security review (both halves)

Checked by running attacks against the harness and the dashboard (`scripts/probe-api.mjs`: 98 checks,
`scripts/probe-bff.mjs`: 33 checks), reading the code, and the dependency and bundle scans.

**Held up** (verified, nothing to fix): session fixation (every sign-in mints a new session; a client-supplied cookie
is ignored); cookie flags (`HttpOnly`, `SameSite=Strict`, `__Host-` + `Secure` on https, no `Domain`); CSRF on login,
logout and every proxied verb (cross-site, missing, `null`, look-alike and userinfo origins; `Sec-Fetch-Site`); the
proxy allow-list (path traversal, encoded slashes, absolute URLs, other auth routes, bodies over 64 KB, non-JSON); no
SSRF (the proxy only builds `ADMIN_API_URL + a fixed allow-listed path`, redirects are errors); open redirects after
sign-in (`?next=` is same-site relative only; a tab hidden in it was found and fixed on 2026-10-07, see below); header injection (Node refuses CR/LF in forwarded headers); user
enumeration (one generic 401, same work and the same timing for unknown users); lockout bypass by case, full-width
or zero-width characters (the name must match exactly, so a variant is just an unknown user); TOTP replay (a code
works once, older steps are refused); role escalation (`PATCH` own role is refused, a role is read from the database on
every request, role changes end the user's sessions); mass assignment (unknown fields are refused on products, users,
orders); audit tampering (no write routes, entries expire only by TTL); CSV injection (cells starting with `= + - @`
get an apostrophe, checked on orders, candles and messages); log injection (line breaks in a typed username are
flattened in the audit log); ReDoS (every user-facing regular expression is linear or bounded; search text is
escaped); secrets in the client bundle (`.next/static` holds no API address, key or password; the shared fetch helper
mentions `Bearer` but is never given a token in the browser); `npm audit --omit=dev`: 0 vulnerabilities in `admin`
and in `server`.

**Fixed**:

| Finding | Fix |
|---|---|
| The dashboard passed on a visitor-written `X-Forwarded-For` to the API: anyone could pick the address the API rate-limits and logs | only Netlify's header is trusted; `X-Forwarded-For` needs `ADMIN_TRUST_XFF=1`; the value is validated; unit tests |
| `mailto:` links built from visitor-typed addresses: the public forms allow `?` and `&` in the local part, so `a?cc=x&bcc=y@host` would pre-fill Cc/Bcc in the admin's mail client | address is URL-encoded and checked; unit tests |
| Product photo upload trusted the browser's file type (taken from the file name) | the first bytes must be a JPEG, PNG, GIF, WebP or AVIF image and match the claimed type; the upload is sent with the detected type; unit tests |
| The API's text sanitizer is described as "escapes & < >" but keeps `<b>`, `<i>` and `<a href>` | documented (ADMIN.md 4.2); the dashboard never renders stored text as HTML (React escapes it, no `dangerouslySetInnerHTML` anywhere) |
| 2026-10-07 review: the legacy `POST /auth/login` and `/admin/login` gave any account (viewer, disabled, locked, TOTP on) an 8-hour, unrevocable, unaudited token for every order and message | both sign-ins, `requireAdmin` and every legacy route removed; a legacy token is refused everywhere (ADMIN.md 7; `server/__tests__/auth.test.js`) |
| 2026-10-07 review: `?next=/%09/evil.example` passed `safeNextPath` (browsers drop the tab and go to `//evil.example`) | strict check after decoding and URL normalisation (`admin/src/lib/session.ts`; 60 cases in `tests/unit/session.test.ts`) |
| 2026-10-07 review: a stolen session could enrol its own authenticator | `POST /admin/auth/totp/setup` needs the current password; Settings asks for it |
| 2026-10-07 review: CORS trusted every `*--nazarethholycross.netlify.app` and the old admin site | only `deploy-preview-<digits>--nazarethholycross.netlify.app` and the production origins |

**Open (not fixed; decide before or soon after launch)**:

1. **Per-address rate limits see the dashboard host, not the visitor.** The API runs with `trust proxy` 1 and takes the
   last `X-Forwarded-For` entry, which behind Render is the Netlify function's address. So the 5-per-name and
   30-per-address sign-in limits are shared by everyone, and the audit trail's address hash is the same for every
   entry. The per-account lockout (5 failures, 15 minutes) is what really protects accounts. A fix needs a secret
   shared between the dashboard and the API, or `trust proxy` 2 plus accepting that a direct caller of the API could
   then choose its own address; both change the API's trust model, so not done here.
2. **Anyone can lock an account for 15 minutes** by failing the password five times (the price of lockout). An owner
   re-enables the account. Two-factor does not prevent it. With open item 1 it can also trip the shared address limit
   (30 failed sign-ins in 15 minutes from anyone) and block everybody's sign-in for that time.
3. **Password policy failures count toward the 5-per-15-minutes limit** of the password route (a person who tries
   five weak passwords is blocked for 15 minutes). Harmless; noted.
4. **Dev-only dependency warnings**: `npm audit` (full) reports 5 high findings in `admin` (via `eslint-config-next`) and
   3 in `server` (via `nodemon`), all the `braces` stack-exhaustion advisory in tooling that never ships. The only
   offered fix is a breaking downgrade. Production dependencies: 0.
5. **Firebase Storage rules** (outside this repository): the upload checks above are client-side; only the bucket's
   rules can stop a direct write. Restrict them (section 6).
6. **No test ran against a real MongoDB or on Render/Netlify** (ADMIN.md 11): index creation, TTL purge timing and the
   Next.js runtime on Netlify are checked only by the rule in section 4.
7. A stolen **valid session cookie** works until sign-out, expiry (60 minutes) or revocation: the cookie is not bound
   to a device. The idle sign-out (30 minutes) and `HttpOnly`/`SameSite=Strict` limit the exposure.
