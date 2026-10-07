# Monitoring: what to watch, when to worry, what to do

The goal: the owner hears about a problem **before a visitor tells him**, and every known failure has a written fix.
Cheap on purpose: one free uptime monitor, one script after each deploy, one keep-alive job. Infrastructure facts
(DNS, regions, measurements) are in [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

## 1. The three layers

| Layer | What | When | Who is told |
|---|---|---|---|
| **External uptime monitor** (UptimeRobot free or Better Stack free) | requests the URLs of section 2 every 5 minutes from outside, e-mails (and pushes to the phone app) when one fails twice | all day, every day | the owner's e-mail and phone |
| **`ops/smoke-live.mjs`** | about 35 pages in a real browser plus redirects, headers, certificate, API and database checks | **after every deploy** (mandatory, `docs/ENGINEERING.md` section 3) and when something feels wrong | whoever runs it (PASS / WARN / FAIL, exit code 1 on FAIL) |
| **GitHub `Keep API awake`** (`.github/workflows/keepalive.yml`) | a request to the API every 10 minutes so Render's free plan never goes to sleep | every 10 minutes | a failed run e-mails the repository owner. A convenience, not a guarantee (below) |

Plus the owner's inbox: GitHub (failed `Security` and `CI` runs, Dependabot), Netlify (failed deploys), Render (failed
deploys, "service failed"), MongoDB Atlas (alerts are on by default for the cluster; keep them), PayPal.

## 2. The monitors to create (exact URLs)

Create them in **UptimeRobot** (free: 50 monitors, 5-minute interval, e-mail alerts, "keyword" monitors; free plan is for
non-commercial use) or **Better Stack** (free: 10 monitors, 3-minute interval, e-mail + phone push, SSL and domain expiry
checks). Alert contact: the owner's e-mail **and** the phone app, so an e-mail in a busy inbox is not the only signal. Set
"alert after 2 failed checks" to ignore a single hiccup.

| # | URL | Type, expectation | Why | Alert when |
|---|---|---|---|---|
| 1 | `https://nazarethholycross.com/en` | HTTPS, status 200, keyword `Nazareth` | the site is up and is not a 404 page | 2 failures in a row (about 10 minutes) |
| 2 | `https://nazarethholycross.com/en/shop` | HTTPS, 200, keyword `Shop` | the page that needs the API (products) | same |
| 3 | `https://nazarethholycross.com/sitemap.xml` | HTTPS, 200, keyword `<urlset` | search engines can read the site; also proves the API-backed sitemap works | same |
| 4 | `https://nazareth-holy-cross-api-production.up.railway.app/health/deep` | HTTPS, 200, keyword `"status":"ok"` | the API answers **and reaches MongoDB**. Answers 503 when Atlas is unreachable | same. The first check after a long sleep may take 30-60 s: set the monitor timeout to 60 s |
| 5 | `https://nazareth-holy-cross-api-production.up.railway.app/product/catalog` | HTTPS, 200, keyword `products` | the data the shop shows | same |
| 6 | `https://admin.nazarethholycross.com/login` (the new dashboard; `nazarethholycross.com/admin` forwards there) | HTTPS, 200 | the dashboard is up (a Netlify site without its runtime answers 404 on every page) | same |
| 7 | the domain `nazarethholycross.com` | Domain expiry (Better Stack) | the registration ends **2027-08-26** (GoDaddy) | 30, 14 and 7 days before |
| 8 | `nazarethholycross.com` | SSL certificate expiry | Netlify renews automatically about 30 days before the end; an alert below 14 days means renewal is stuck | 14 days |

`/health/deep` costs the database one ping per 5 seconds at most (the answer is cached for 5 s), and it has its own
rate-limit counter (300 per 15 minutes), so monitors and keep-alive can never be refused because of other traffic.
It shows version, commit, uptime, database latency and the PayPal mode (`sandbox`/`live`), and never a secret.

## 3. Thresholds

| Signal | Normal (measured 2026-10-06 from Israel) | Look at it | Act |
|---|---|---|---|
| Site HTML (server wait, after the connection) | 250-650 ms | > 1.5 s for a day | Netlify -> Functions -> logs and the function region (INFRASTRUCTURE.md 3.3) |
| Static files | 60-170 ms | > 1 s | Netlify status page |
| API `/health` warm | 230-280 ms (Oregon, through Cloudflare Tel Aviv) | > 1 s | Render -> Metrics |
| API after sleep | 23 s in the one sample taken (Render quotes 30-60 s; INFRASTRUCTURE.md 2.1) | the first request after > 15 min idle takes tens of seconds | keep-alive + external monitor, or paid instance |
| `/health/deep` `database.latencyMs` | single-digit to low double-digit ms when Render and Atlas share a region; > 100 ms means they are on different continents | > 150 ms | Atlas region (INFRASTRUCTURE.md 2.4) |
| `/health/deep` `uptimeSeconds` | grows | resets to a small number without a deploy | the service crashed or slept: Render -> Logs |
| API rate-limit header `RateLimit: remaining=` | 100+ of 200 | < 30 on a normal day | many visitors share one counter (INFRASTRUCTURE.md 2.5) |
| Certificate days left | 30-90 | < 21 | Netlify -> Domain management -> HTTPS -> Renew |
| Domain days left | > 30 | < 60 | GoDaddy: renew, auto-renew on |
| `ops/smoke-live.mjs` | all PASS | any WARN | read the line; WARN is "works, but look" |
| CI on `main` | green | red | fix before the next merge (REPOSITORIES.md finding 2 is red today) |

## 4. After every deploy (the mandatory step)

```bash
node ops/smoke-live.mjs                  # about 2 minutes, read-only, uses about 40 of the API's 200 requests per 15 minutes
node ops/smoke-live.mjs --no-browser     # HTTP-only version when no browser is installed
node ops/smoke-live.mjs --site https://deploy-preview-12--nazarethholycross.netlify.app    # a deploy preview before merging
```

It needs `npm ci` once in `web/` (Playwright) and Microsoft Edge (`PW_CHANNEL=chromium` for Playwright's own browser).
It never submits a form and never presses a PayPal button. **Exit code 1 means FAIL: roll back first, then investigate**
(ENGINEERING.md section 3). A scheduled task on the owner's PC can run it at 08:00 and open a file on failure; running it
after deploys is what is mandatory.

What it catches: a cached 404 after a deploy (it asks each key page twice, once with a cache-busting query); a page that
answers 200 but throws a script error or a CSP violation; broken images; a redirect chain; a wrong or missing header;
an expiring certificate or `security.txt`; the API cold start; the database being unreachable; CORS for the real origins;
PayPal still on `sandbox` (a WARN until the switch to Live).

## 5. Runbooks: the failures seen so far

### 5.1 Netlify answers 404 on every page after a deploy (seen 2026-10-05, PRs #20 and #21)

**Symptoms.** The deploy shows "Published", the build log is green, but `https://nazarethholycross.com/en` is `404`
with `Server: Netlify` and `Cache-Status: "Netlify Edge"; fwd=miss; fwd-status=404`. `smoke-live` fails "no stale 404 on /en".

**Causes (both happened or are one step away).**
1. The **Next.js runtime plugin did not run**. A Next.js site built without `@netlify/plugin-nextjs` "succeeds" and then
   serves nothing but 404. The root `netlify.toml` names the plugin explicitly for this reason, and
   `tests/unit/netlify-config.test.ts` fails if that line is removed. The same rule is in `admin/netlify.toml`.
2. An **edge-cached 404**: Netlify's edge stored the 404 answers and keeps serving them after the fix. `smoke-live`
   shows it as "clean 404, cache-busted 200".

**Fix, in this order.**
1. Netlify -> Deploys -> open the previous good deploy -> **Publish deploy** (rollback in seconds).
2. Look at the bad deploy's log: is "Next.js Runtime" listed under plugins? Are the base directory (`web`) and publish
   directory (`.next`) the ones in `netlify.toml`?
3. If a good deploy is live but pages are still 404 for some visitors or URLs: Deploys -> **Trigger deploy -> Clear
   cache and deploy site**. That purges the edge.
4. `node ops/smoke-live.mjs`. Then revert the bad commit on `main` with a pull request.

**Prevention.** The deploy preview of a pull request must answer 200 on `/en` before merging (the rule of
`admin/netlify.toml` applies to the public site as well): `node ops/smoke-live.mjs --site <preview url> --no-browser`.

### 5.2 The API is up but cannot reach MongoDB: Atlas IP allowlist blocks Render

**Symptoms.** `/health` says `"database":"down"` (still HTTP 200!); `/health/deep` answers **503** with
`"state":"connecting"` or `"disconnected"`; the shop and forms fail; Render -> Logs repeat `DB failed to connect, retrying
in 10s` with a message about the IP address not being on the allow list. Typical after changing the cluster, the Atlas
network rules, or when Render's outbound addresses change.

**Fix.** MongoDB Atlas -> **Network Access** -> look at the list.
- Quick and safe enough for a free Render service (it has no fixed address): an entry **`0.0.0.0/0`** ("allow access from
  anywhere"). The database is still protected by its user name and password; keep that password long and unique.
- Tighter: Render -> the service -> **Connect -> Outbound** shows the service's outbound IP ranges: add those ranges
  instead of `0.0.0.0/0`, and check again when Render announces a change.
No redeploy is needed: the server retries every 10 seconds, and `/health/deep` turns 200 within about 10 s.
Confirm with `curl https://nazareth-holy-cross-api-production.up.railway.app/health/deep`.

**Prevention.** Monitor #4 (it goes red on exactly this). Never remove a network entry without checking `/health/deep` after.

### 5.3 GitHub Actions is down or queued for hours (seen before in this project)

**Symptoms.** Pull request checks stay "Queued" or "Waiting for a runner" for far longer than the usual 5-16 minutes;
<https://www.githubstatus.com> shows an Actions incident.

**What it does and does not break.** Production is **not** affected: Netlify and Render deploy from their own GitHub
apps, not from Actions. What stops: the checks (so a protected `main` cannot be merged), the weekly `Security` scan,
Dependabot's PR checks, and the keep-alive job (so the API may start sleeping: monitor #4 keeps it awake).

**What to do.**
1. Wait if the change is not urgent; do not merge around a red or missing check.
2. If it is urgent (a hotfix), **run the same checks yourself** and paste the results in the pull request:
   `cd server && npm test`, `cd web && npm run check && npm run test:e2e`, `cd admin && npm run check`. Only then
   edit the `main` ruleset (Settings -> Rules), merge, and switch the rule back on. Write why in the pull request.
3. After the outage: re-run the checks of anything merged meanwhile (Actions -> Re-run all jobs) and run
   `node ops/smoke-live.mjs`.

### 5.4 Other failures worth a line

| Symptom | Likely cause | First action |
|---|---|---|
| The shop is slow or shows an error once in a while, the API answers after 30-60 s | Render free plan went to sleep (cold start) | check `/health/deep` `uptimeSeconds`; keep-alive and monitor #4 should prevent it; see INFRASTRUCTURE.md 2.1 |
| Visitors get "Too many requests" (429) | the per-IP limit counts a **shared** address: all visitors seen through the same Cloudflare address share one counter | INFRASTRUCTURE.md 2.5 (`TRUST_PROXY_HOPS`); look at the `RateLimit` header |
| E-mails (candles, contact, shipping) stop | the Gmail app password was revoked (it dies when the Gmail password changes) or Google blocked the sign-in | Render logs `Email send failed`; create a new app password, update `MAIL_APP_PASSWORD`, redeploy |
| PayPal buttons missing or "payment unavailable" | the PayPal client id and the API credentials belong to different environments, or the SDK is blocked by the CSP | `/health/deep` `paypalMode`, INFRASTRUCTURE.md 3.5, browser console |
| Product photos missing | Firebase Storage rules, quota, or a token changed | open one photo URL directly; Firebase console -> Storage |
| Certificate warning | Let's Encrypt renewal stuck, or a changed DNS record | Netlify -> Domain management -> HTTPS |
| `www.nazarethholycross.com` or the domain does not load at all | DNS: someone edited records at Netlify DNS, or the domain expired (GoDaddy) | `nslookup nazarethholycross.com`; INFRASTRUCTURE.md 1 |
| Netlify build fails with a Next or SWC error | dependency update | roll back the deploy; fix on a branch |

## 6. Who gets what

| Alert | Goes to | Within |
|---|---|---|
| Uptime monitor (site, API, database, certificate, domain) | owner: e-mail + phone push | minutes |
| GitHub: failed CI/Security on `main`, Dependabot | owner's GitHub e-mail | hours |
| Netlify / Render deploy failure | owner's Netlify and Render e-mail | immediately |
| Atlas alerts (connections, storage, down) | owner's Atlas e-mail (Project -> Alerts: check the list is on) | minutes |
| A person's report | `nazarethholycross@gmail.com` and `/.well-known/security.txt` | 3 working days (SECURITY.md) |

A single owner is a single point of failure: **add a second person** to the monitors' alert contacts (and as a Netlify,
Render and Atlas team member) so an alert at night or during a trip is seen by someone.

## 7. What is NOT monitored yet

- Real-user speed worldwide (only one PC in Israel was measured). Add Netlify Analytics or a free RUM tool, or run
  WebPageTest from Europe and the USA.
- Errors inside the API (a thrown exception that still answers 500 now and then): Sentry is on the roadmap
  (`docs/ENGINEERING.md` section 8).
- Failed PayPal captures (no PayPal webhook yet, `docs/SECURITY.md` section 7): the Render log names the PayPal order id.
- Backups: production is on Atlas M10 with Cloud Backup on (INFRASTRUCTURE.md 6.1); check the cluster's *Backup* tab shows recent snapshots.

## 8. Hermes on Telegram (watchdog and morning report)

Hermes Agent runs 24/7 on Railway (project `divine-spontaneity`, service `hermes`, `HERMES_HOME=/opt/data`, timezone
Asia/Jerusalem) and delivers to the owner's Telegram. Two script-only cron jobs (no AI model, so no data reaches one):

| Job | Schedule | Script | Sends |
|---|---|---|---|
| `nhc-watch` | every 5 minutes | `ops/hermes/nhc_watch.py` | nothing while all is well; an alert after two failures in a row, a reminder every 2 h while it stays down, a "back" message on recovery |
| `nhc-daily` | 08:00 | `ops/hermes/nhc_summary.py` | always: status of every check, the last 24 h (checks run, uptime, incidents), and **what changed** since the previous report |

"What changed" reads only public data: merged pull requests (= what was published), the Railway API deploy status
and failing checks on `main`, open pull requests waiting for review (GitHub API), and the shop compared with the
previous morning (public `/product/catalog`: new, removed and edited products, price, stock, photos, description, the
`sold` counter and new reviews). The first report after an install records the shop and reports changes from the next
day. The state lives in `/opt/data/nhc-watch-state.json`. Every time in a message is Israel time (`NHC_TZ`,
default `Asia/Jerusalem`): the Railway server itself runs on UTC.

To update the scripts on Hermes after a merge: download both files from `main` into `/opt/data/scripts/` (`railway ssh`
into the `hermes` service). The Render checks in the script run only with `NHC_WATCH_RENDER=1` (the API left Render on
2026-10-07). Hermes itself runs on Railway: a Railway-wide outage silences it, so keep an outside monitor (section 2)
and treat a missing 08:00 report as an alert.
