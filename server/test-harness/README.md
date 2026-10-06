# The local API harness

The REAL admin API (`server/app.js` `createApp()`, every route, validator, guard and service) running over **in-memory
copies of the Mongoose models**, so the dashboard can be run, clicked through and tested end to end on a PC with no
MongoDB. Nothing here is a mock of the API's behaviour: only the database, the mailer and PayPal are replaced.

```bash
cd server
node test-harness/serve.mjs            # http://127.0.0.1:3912   (npm run harness)
```

Then the dashboard against it (second terminal):

```powershell
cd admin
$env:ADMIN_API_URL = "http://127.0.0.1:3912"
npm run build; npx next start -p 3911   # or: npm run dev   (port 3901)
```

Open <http://localhost:3911/login>. Data is lost when the process stops, and `POST /__harness/reset` puts it back to
the seed (every account, lock, session and rate-limit counter too).

## Accounts (throw-away, exist only inside this process)

Created through the real `scripts/create-admin.js` logic (`createOwner`: policy check, cost-12 bcrypt), then the role
and the second factor are set the way the dashboard's own routes do it.

| Username | Password | Role | Note |
|---|---|---|---|
| `owner` | `Owner-Mock-Pass-1` | owner | |
| `editor` | `Editor-Mock-Pass-1` | editor | |
| `viewer` | `Viewer-Mock-Pass-1` | viewer | |
| `secure` | `Secure-Mock-Pass-1` | owner | two-factor ON, secret `JBSWY3DPEHPK3PXP` (put it in any authenticator app) |
| `tempowner` | `Tempowner-Mock-Pass-1` | owner | a second owner, to try demoting/deleting owners |
| `locktest` | `Locktest-Mock-Pass-1` | editor | spare: for lockout tests |
| `passchange` | `Passchange-Mock-Pass-1` | editor | spare: for password-change tests |
| `totpsetup` | `Totpsetup-Mock-Pass-1` | editor | spare: for two-factor set-up tests |
| `resetpass` | `Resetpass-Mock-Pass-1` | editor | spare, with the invented address `resetpass@example.com`: for forgotten-password tests |

They are the same names and passwords as the mock API (`admin/mock-api`), so the end-to-end suite runs unchanged
against either. They are public: never use them anywhere real.

## What it contains (seed, relative to "now")

62 products (one out of stock, 13 low), 42 orders over the last 60 days (3 without a verified payment, 5 pending),
30 candle requests, 24 messages, 12 site reviews, 25 product reviews, 24 prayers, and the payment ledger: a captured payment for every
verified order plus the cases the Payments screen is for (two payments paid but never saved, one resolved by hand, donations, an abandoned checkout, a declined card). A few rows are there to be
awkward on purpose: names that start with `-` or `=` or `@` (CSV injection), text stored with `&amp;` (the API
stores `&` that way), Hebrew and Arabic names.

## Safety

* It never reads a `.env` (`dotenv` is replaced by a no-op), never connects to MongoDB, SMTP or PayPal, and starts
  with a random throw-away `JWT_SECRET` (a restart signs everyone out). Environment variables that name real services
  are deleted at start.
* It listens on 127.0.0.1 only. The test hooks (`/__harness/*`) exist only when `HARNESS=1` (set by `serve.mjs`) and
  refuse any address that is not this machine.
* Live broadcasting talks to a fake Cloudflare Stream (`fake-cloudflare.js`, addresses on `customer-harness.cloudflarestream.com`):
  never to Cloudflare. `POST /__harness/live {"configured": false}` behaves like a server without `CF_ACCOUNT_ID` /
  `CF_STREAM_API_TOKEN`, `{"failCreate": true}` like Cloudflare refusing; `/__harness/reset` puts both back.
  Recordings: the fake hands out one-time upload addresses on `https://upload.videodelivery.net/tus/<uid>?tusv2=true`, but
  nothing is ever sent there (the dashboard's end-to-end tests answer those requests inside the browser). `GET
  /__harness/live` lists the fake's inputs and videos; `POST /__harness/live {"videoState": "ready", "videoUid"?: "...",
  "durationSeconds"?: 60}` moves videos through Cloudflare's processing (`queued`, `inprogress`, `ready`, `error`) as if
  they had been uploaded; `{"failUpload": true}` makes it refuse an upload address.
* Mail goes to a recorder, `GET /__harness/emails`. `POST /__harness/mail {"fail": true}` makes the mailer fail like
  an SMTP outage. Password-reset mails link to `http://localhost:<HARNESS_ADMIN_PORT>` (`ADMIN_APP_URL` is set by
  `serve.mjs`). `POST /__harness/reset {"accounts": false}` starts with no admin account, the state in which a reset
  request for `nazarethholycross@gmail.com` creates the first owner.

## How it works

`hooks.mjs` registers Node module hooks before the server is imported: `server/model/*.js` resolve to the fakes in
`harness-models.js` (built on `fake-models.js`, the same fakes the 700+ server tests use), `emailService.js` to a
recorder, `paypalService.js` to a stub that refuses (and `serve.mjs` installs the fake Cloudflare client), `dotenv` to a no-op, and `express-rate-limit` to the real library
with stores the harness can reset. `aggregate.js` is a small aggregation interpreter for the dashboard's pipelines.
`seed.mjs` builds the data and the accounts; `control.js` has the `/__harness` routes; `serve.mjs` starts it all.

## Limits (what it cannot tell you)

It cannot show how a real MongoDB behaves (indexes, TTL purge timing, casting, collation). The fakes understand the
operators the routes use and the tests run every filter through `mongoose.sanitizeFilter` and the real schemas, but run
the first sign-in and one of each change on a staging database before production (docs/ADMIN.md section 11).
