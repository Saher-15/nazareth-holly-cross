# Infrastructure: domain, DNS, hosting, regions

What stands between a visitor and the site, what was measured on **2026-10-06**, and exactly what to change. Measured
from one PC in Israel with `nslookup`, `curl`, a TLS probe and Node; nothing was changed anywhere. There is **no access
to GoDaddy, Netlify, Render, MongoDB Atlas, Firebase or PayPal** from the audit: whatever needs a login is marked
**owner** and is *not verified*. Watching and recovery: [MONITORING.md](MONITORING.md). Repositories:
[REPOSITORIES.md](REPOSITORIES.md).

```
GoDaddy  (registrar: owns the name, expires 2027-08-26)
   |  name servers are delegated to ->
Netlify DNS (NS1: dns1-4.p0x.nsone.net)   <- the DNS records live HERE, not at GoDaddy
   |  nazarethholycross.com, www  ->  Netlify edge (2 AWS Frankfurt addresses)
Netlify: public site (web/)  -- server-side and browser --> Render: API (Oregon, free plan, behind Cloudflare)
Netlify: admin site (old)                                          |--> MongoDB Atlas (region: owner)
                                                                   |--> PayPal, Gmail (SMTP)
Firebase Storage: product photos and videos (served through Netlify's image CDN)
```

## 1. Domain, DNS and TLS

### 1.1 The most important finding: DNS is at Netlify, not at GoDaddy

| Fact | Evidence |
|---|---|
| Registrar: **GoDaddy.com, LLC** (IANA 146). Registered 2024-08-26, **expires 2027-08-26**, last changed 2026-08-27 | RDAP (`rdap.verisign.com`) |
| Statuses: client delete, renew, transfer and update **prohibited** (the registrar lock; normal and good) | RDAP |
| Name servers at the registry: `DNS1-4.P06.NSONE.NET` = **Netlify DNS** (NS1) | RDAP, `nslookup -type=NS ... a.gtld-servers.net` |
| The zone's own NS records name `dns1-4.p04.nsone.net` (a different NS1 group). Both groups answer the zone, so it works, but registry and zone disagree | `nslookup -type=NS` against `dns1.p06` and `dns1.p04` |
| DNSSEC: **not signed** (`delegationSigned: false`, no DS, no DNSKEY) | RDAP, DNS-over-HTTPS |
| SOA contact `domains+netlify.netlify.com`, serial 1732044085 | `nslookup -type=SOA` |

**Consequence: a DNS record added in GoDaddy's DNS panel has no effect.** Every record below is added in **Netlify ->
Domains -> nazarethholycross.com -> DNS records** (the team's "Domains" page, or the site's Domain management).
GoDaddy only holds the registration and the name-server setting; leave that setting on the four Netlify name servers.

### 1.2 Records today

| Name | Type | Value | TTL |
|---|---|---|---|
| `nazarethholycross.com` | A | `63.176.8.218`, `35.157.26.135` (AWS eu-central-1, Frankfurt) | 120 s |
| `nazarethholycross.com` | AAAA | `2a05:d014:58f:6200::258`, `::259` | 311 s |
| `www.nazarethholycross.com` | A / AAAA | the same four addresses (no CNAME shown: Netlify flattens it) | 120 / 311 s |
| `nazarethholycross.com` | NS | `dns1-4.p04.nsone.net` | 3600 s |
| MX | - | **none** | |
| TXT (SPF, verification) | - | **none** | |
| `_dmarc` TXT | - | **none** | |
| CAA | - | **none** | |
| DS / DNSKEY | - | **none** | |

A low TTL (2 minutes) means a change at Netlify reaches visitors within minutes, which is good for this setup. No record
is wrong. Not set: SPF/DMARC (section 1.8), CAA (optional), DNSSEC (not recommended, below).

### 1.3 Certificate and TLS

| | Value |
|---|---|
| Certificate | Let's Encrypt, intermediate `YE2` (ECDSA P-256), **wildcard**: `nazarethholycross.com` + `*.nazarethholycross.com` |
| Valid | 2026-09-13 to **2026-12-12** (67 days left on 2026-10-06). Let's Encrypt certificates last 90 days; Netlify renews automatically about 30 days before the end |
| Protocols | TLS 1.3 and 1.2 accepted, HTTP/2 negotiated (ALPN `h2`), AEAD ciphers only. TLS 1.0/1.1 could not be probed: this PC's own client refuses them, so the server's answer is unknown (**not verified**; check with an online TLS test such as Qualys SSL Labs) |
| OCSP | no stapled response. Let's Encrypt stopped using OCSP in 2025, so there is nothing to staple |
| HTTP/3 | **not advertised** by the site (no `alt-svc`). The API, behind Cloudflare, advertises `h3` |
| Both hosts | the same certificate covers the apex, `www` and any subdomain (so `admin.nazarethholycross.com` can be added without a new certificate setup) |

The monitors of MONITORING.md section 2 (#8) and `ops/smoke-live.mjs` warn when fewer than 21 days are left.

### 1.4 One address: redirects, canonical host, trailing slash

| Request | Answer | Hops to the final page |
|---|---|---|
| `https://nazarethholycross.com/` | 307 -> `/en` (language chosen from the cookie, then `Accept-Language`) | 1 |
| `https://nazarethholycross.com/en/shop/` (trailing slash) | 308 -> `/en/shop` | 1 |
| `https://www.nazarethholycross.com/` | 301 -> `https://nazarethholycross.com/` -> 307 `/en` | 2 |
| `http://nazarethholycross.com/` | 301 -> `https://nazarethholycross.com/` -> 307 `/en` | 2 |
| `http://www.nazarethholycross.com/` | 301 -> `https://www...` -> 301 -> `https://nazarethholycross.com/` -> 307 `/en` | **3** (a chain) |
| `https://nazarethholycross.netlify.app/en` | **200** (the free Netlify address serves the same site: two hosts for one site) | - |

Canonical host: the **apex** `nazarethholycross.com` (the page's `<link rel="canonical">` and the sitemap say so).
Fixes in this change (`netlify.toml`): the `netlify.app` address now redirects (301) to the real domain. The `http://www`
chain of three is rare (typed by hand, old links) and each redirect is 70-150 ms; HSTS preload (below) removes the `http`
hops for returning visitors. The `/` -> `/en` redirect is deliberate (language negotiation) and cannot be cached.

**2026-10-07 (branch `fix/perf-seo-a11y`, review 05 finding 12):** `netlify.toml` now sends `http://www.…/*` straight to
`https://nazarethholycross.com/:splat` (301, one hop instead of two; check after the deploy with
`curl -sI http://www.nazarethholycross.com/en/shop`: one 301 whose `location` is the apex). The old site's addresses
(`/latin`, `/product/<id>`, `/checkoutcandle`, `/checkoutdonation`) used to take a temporary hop first (307 `/latin` ->
`/en/latin`, then 308 -> `/en/sites/latin`): `src/proxy.ts` now answers them with **one 308** straight to the page in the
visitor's language (`src/lib/legacyPaths.ts`; English for crawlers, `no-store` and `Vary: Accept-Language, Cookie`
because the target depends on the language). `next.config.ts` keeps only the language-prefixed forms (`/en/latin`, 308).

### 1.5 HSTS and security headers

On a page (`/en`): `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, a nonce-based
`Content-Security-Policy` (no `unsafe-eval`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a strict `Permissions-Policy`, `Cross-Origin-Opener-Policy:
same-origin-allow-popups`, `Cross-Origin-Resource-Policy: same-origin`. No `X-Powered-By`. (No COEP on purpose: it would
block PayPal and the Firebase media.)

**HSTS preload: the site is NOT eligible today** (`hstspreload.org` answered "No includeSubDomains / no preload
directive"). Cause, found by reading the redirect answers: the redirects (`/` -> `/en`, `www` -> apex, trailing slash)
carry only Netlify's own `max-age=31536000`, and the preload check reads that first answer. **Fixed in this change for the
`/` redirect** (`web/src/lib/hsts.ts`, `web/src/proxy.ts`, unit test); the `www` and trailing-slash redirects are Netlify's
own and keep the one-year value, so after deploying, **re-run** `curl -sI https://nazarethholycross.com/` and
<https://hstspreload.org/?domain=nazarethholycross.com>. **Do not submit to the preload list yet**: removal takes months,
and every present and future subdomain (an admin on `admin.nazarethholycross.com`, a mail host) must then be https-only
for good. Decide when the admin domain is settled. Preload is a nice-to-have, not a requirement.

### 1.6 404, robots, sitemap, well-known, caching, compression

| Item | Result |
|---|---|
| Unknown page `/en/xxx` | **404** with the site's own page, `noindex`, `Cache-Control: no-store` (so a 404 is not stored at the edge). An unknown address without a language (`/xxx`) is first redirected (307) to `/en/xxx`, then 404: two hops |
| `/robots.txt` | 200, `text/plain`, allows everything but `/api/`, lists the sitemap |
| `/sitemap.xml` | 200, 533 KB, 1,218 URLs (14 languages with alternates), built from the API |
| `/.well-known/security.txt` | **404 -> added in this change** (`web/public/.well-known/security.txt`, expires 2027-10-06: renew yearly) |
| `/favicon.ico`, `/manifest.webmanifest` | 200 |
| HTML | `Cache-Control: private,no-cache,no-store` (per-request CSP nonce: never shared), Brotli, `Netlify-Vary` set |
| `/_next/static/*` | `public,max-age=31536000,immutable`, Brotli, edge-stored |
| `/images/*`, `/videos/*`, `/sounds/*` (the files of `web/public`) | **`public,max-age=0,must-revalidate`**: Netlify's CDN ignores `next.config.ts` headers() for them, so the browser asked again for every photo on every visit (a conditional request, about 0.3 s). **Fixed in `netlify.toml`** (same values as `next.config.ts`: 1 day + 7 days stale-while-revalidate; 30 days for `nazareth-media` and videos). A unit test fails when a new folder under `public/` has no rule |
| `/_next/image?...` (Firebase photos through Netlify's image CDN) | `private,max-age=0`, `Cache-Status: ... fwd=miss` on **every** repeat request, **1.0-1.4 s** each (6 measured; a conditional request also takes 1.1 s: it is revalidated at the origin each time). `images.minimumCacheTTL` (31 days) does not apply on Netlify. An experiment rule was added to `netlify.toml` (section 3.4); if Netlify ignores it, the fix is in section 3.4 |

### 1.7 Speed from here (one PC in Israel, 5-6 samples each: not "worldwide")

| What | Measured |
|---|---|
| TCP connect to Netlify | 60-90 ms (IPv4). `curl` over IPv6 first showed 270 ms: **this PC has no working IPv6** and waits 200 ms before falling back, an artefact of the PC, not the site |
| TLS handshake (1.3) | about 65 ms on top |
| Static file, server wait | 61-67 ms edge hit, 310-360 ms when the edge had to ask the origin |
| Home page HTML, server wait (after TLS) | 420-510 ms (SSR, cannot be cached) |
| `/en/shop`, `/en/sites/latin` | 250-660 ms |
| A build chunk (JS) | about 165 ms |
| Whole home page (document) | 0.9-1.1 s with IPv6 fallback, about 0.6-0.7 s with IPv4 |

For worldwide numbers use WebPageTest (Frankfurt, Virginia, Tel Aviv) or Netlify Analytics; none was run. Lighthouse numbers
from the local build are in `docs/PERFORMANCE.md`.

### 1.8 Recommended DNS records and registrar steps (non-expert steps, flagged by risk)

Where: **Netlify**, Domains -> `nazarethholycross.com` -> **DNS records** -> *Add new record*. (Not GoDaddy: section 1.1.)

| # | Do | Risk | Why / how |
|---|---|---|---|
| 1 | **GoDaddy: turn on Auto-renew** and check the card; set a reminder for 2027-07-01 | none | the domain expires 2027-08-26; an expired domain takes the shop, the e-mail address of the site and the admin down at once. GoDaddy -> My Products -> Domains -> `nazarethholycross.com` -> Auto-renew |
| 2 | **GoDaddy: two-factor sign-in** on the account, and make the registrant e-mail one the owner reads | none | an account takeover at the registrar loses the domain. Keep the **domain lock** (it is on) |
| 3 | **GoDaddy: leave the name servers on the four Netlify ones.** Do not "reset to default" | high if changed | switching them back takes the site offline until the old records are rebuilt |
| 4 | **Netlify: add a null SPF record**: type `TXT`, name `@` (the domain), value `v=spf1 -all` | low | says "this domain sends no e-mail": stops strangers forging `@nazarethholycross.com`. **Skip it if you ever send mail from the domain** (see 1.9: then use the provider's value instead) |
| 5 | **Netlify: add DMARC**: type `TXT`, name `_dmarc`, value `v=DMARC1; p=reject; adkim=s; aspf=s; rua=mailto:nazarethholycross@gmail.com` | low | tells Gmail and others to reject forged mail from the domain; reports arrive at the Gmail address (they can be many: use a filter, or start with `p=none` for two weeks and switch to `reject`). Only while the domain sends no mail |
| 6 | **Netlify: add CAA** (only if Netlify offers the record type): name `@`, flags `0`, tag `issue`, value `letsencrypt.org`; a second one with tag `issuewild`, value `letsencrypt.org`; a third `iodef` `mailto:nazarethholycross@gmail.com` | **medium** | only Let's Encrypt may then issue certificates. Netlify uses Let's Encrypt today (measured). If Netlify ever changes authority, renewal fails and the site shows a certificate warning in 90 days. Optional; skip it if unsure |
| 7 | **Do not enable DNSSEC** now | high | needs a DS record at GoDaddy that matches Netlify's keys exactly; a mismatch makes the whole domain unreachable for validating resolvers. The risk of the missing feature (DNS spoofing) is small next to that |
| 8 | Optional: `admin.nazarethholycross.com` for the dashboard: Netlify admin site -> Domain management -> Add domain; Netlify creates the record. Then put the exact origin into Render's `ADMIN_ORIGINS` (ADMIN-RUNBOOK.md 3) | low | a separate host name for the admin is easier to protect and to remember. The wildcard certificate already covers it |
| 9 | Do **not** add records you do not understand; do not delete the `A/AAAA` for `@` and `www` (Netlify manages them) | high | |

After 4-6, check with `nslookup -type=TXT nazarethholycross.com` and <https://mxtoolbox.com/SuperTool.aspx>.

### 1.9 E-mail from the site

`server/services/emailService.js` sends through **Gmail SMTP** (`smtp.gmail.com:587`) with the account in `MAIL_FROM` and a
Google **app password** (`MAIL_APP_PASSWORD`). The mail therefore comes **from a `@gmail.com` address**, and Google's own
SPF/DKIM apply: nothing needs to be added to the domain's DNS for it to be delivered. That is why the domain has no
SPF/DKIM/DMARC today and why the null records in 1.8 are right.

Fragile in these ways, none visible until it fails: an app password stops working **when the Gmail password is changed**
or two-step verification is switched off; Google may block sign-ins from a new data-centre address (Render) and ask the
owner to confirm; personal Gmail has a daily sending limit (about 500 recipients) and puts a banner on bulk-looking
mail; the "From" is a personal-looking address, not the organisation's. Failures are logged (`Email send failed`) and the
API still answers; customers just get no mail.

If mail from the domain is wanted (`info@nazarethholycross.com` as the sender), use a transactional provider (Resend,
Brevo, Postmark, Amazon SES: all have a free tier for this volume). The provider shows the exact records; you add them in
**Netlify DNS** (never `v=spf1 -all` then): an SPF `TXT` (`v=spf1 include:<provider> ~all`, one SPF record per name only), two
or three DKIM `CNAME`/`TXT` records, then `_dmarc` as in 1.8 with `p=none` first. Receiving mail at the domain needs MX
records from the mailbox provider (Google Workspace, Zoho, a forwarding service). Code change then: `emailService.js`
(SMTP host, user, password from the provider) and the three environment variables. Not done here; owner's decision.

## 2. The API on Render

### 2.1 Cold start (the free plan sleeps after 15 minutes without a request)

Facts from Render's plan: a free web service stops after about 15 minutes with no inbound request and starts again on the
next one, which takes **30-60 seconds** (Node boots, then the MongoDB connection opens). The free plan has 750 instance
hours a month per workspace: one service kept awake all month uses about 730, so keep-alive on one free service fits;
a second always-on free service would not.

**Measured (one sample, 2026-10-06 11:47 Israel time):** after about 19 minutes in which this audit sent the API nothing,
the first `GET /health` took **22.96 seconds** (the service had gone to sleep; Cloudflare held the request until Render
had started it) and returned 200; the next two took 282 ms and 242 ms. Earlier the same morning, with other traffic
keeping it awake, five spaced calls all answered in 230-280 ms. One sample is not a distribution: Render quotes
30-60 s, so plan for the worst. The response carries no header that says "I was asleep"; `/health/deep` `uptimeSeconds`
(small after a wake-up) is the way to see it.

A side effect seen once: the first run of `ops/smoke-live.mjs` right after the wake-up read a `/sitemap.xml` with only
350 URLs (the static pages, no products; the normal answer has 1,218) and a later request got the full one. The sitemap is
built from the API; when the API does not answer in time the site serves the list without products and the CDN may keep
that answer for a few minutes. Search engines that fetch the sitemap during a cold start see a shorter list. One more
reason not to let the API sleep.

What a visitor feels: the public site pages are rendered by Netlify and read the API with a cache (5 minutes for the
catalogue, 1-2 minutes for reviews and prayers, `stale-while-revalidate`), so a sleeping API rarely blocks a page view.
The browser calls the API for **forms, payments, live data and likes**: the first of those after a quiet period waits
the cold start, and a pilgrim on a phone may give up. The shop checkout (`create_order`) is the case that costs money.

What was done:
- `GET /health/deep` (this change): `{status, version, commit, uptimeSeconds, startedAt, timestamp, paypalMode, memoryMb,
  database:{status, state, latencyMs}}`. 200 when the database answers a ping (2 s deadline), **503 when it does not**.
  No secret, host, user or driver message is ever included (tests assert it). One ping per 5 s at most (cached). Own rate
  limit (300 per 15 min), answered before the general limiter. `/health` stays as it was (always 200) and moved to the same
  separate limiter.
- `.github/workflows/keepalive.yml`: `GET /health` every 10 minutes with retries, from GitHub. **Limits to know:** GitHub
  delays or skips scheduled runs under load; it **pauses scheduled workflows after 60 days without activity** in the
  repository (a push or pull request re-enables it; the owner gets an e-mail); and in a **private** repository it would
  use about 4,320 billed minutes a month (more than the free 2,000), so it is deleted when the repository goes private
  (REPOSITORIES.md step 11).
- **A real uptime monitor is the proper answer**: UptimeRobot (free, 5-minute checks) or Better Stack (free, 3-minute
  checks, phone push). They keep the service awake (a request every 5 minutes) **and** send an alert e-mail, which
  GitHub's job does not do reliably. Exact monitors: MONITORING.md section 2. Create monitor #4 first.
- The only complete cure is a paid instance (Render "Starter", about US$7 a month, never sleeps). Worth it once the
  shop takes real payments (section 3.5): a customer who waits 40 s at checkout is a lost sale.

### 2.2 Latency (warm, 5 samples spaced 4-5 s, one PC in Israel)

| URL | Headers received | Notes |
|---|---|---|
| `/health` | 229-773 ms, typically 230-285 ms | small JSON; `cf-cache-status: DYNAMIC`, edge `CF-RAY ...-TLV` (**Cloudflare Tel Aviv**) |
| `/product/catalog` (84 KB) | 245-681 ms, typically 250-520 ms | `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=3600` is sent, but Cloudflare answers `DYNAMIC` (it does not cache JSON by default), so every visitor reaches Render |

Round trip browser -> Cloudflare Tel Aviv is about 8 ms; the rest, **about 220 ms, is Cloudflare Tel Aviv -> Render Oregon
and back** (the speed of light across the Atlantic and the United States), which is the cost of the region (2.4).

### 2.3 Where the website calls the API

The Next.js site reads the API **on its server** (Netlify function) with `next: { revalidate }` caching (`web/src/lib/api.ts`:
catalogue 300 s, product reviews 60 s, reviews 120 s, retries with a 10 s timeout) and the **browser** calls it for forms
and payments (CORS allows only the real origins, checked live: apex, `www`, the admin site yes; a stranger origin 403).

### 2.4 Region advice (Render vs Atlas vs visitors)

**Update 2026-10-07 (review 05, owner decision, nothing changed in the repository):** the unknowns below are now known.
Atlas is in **AWS Frankfurt** (section 6.1) and the API on Render in **Oregon** (`render.yaml`): production's
`/health/deep` reported `database.latencyMs` **143-144 ms** for a single ping, i.e. every database call of every API
request crosses the Atlantic and the United States. Measured API answers (warm, from Israel): `/product/getNProducts`
0.55-1.05 s, `/live/status` 0.27-0.56 s, `/live/schedule` 0.24-0.47 s. Every JSON answer is `cf-cache-status: DYNAMIC`
although it sends `s-maxage` (Cloudflare does not cache JSON by default). The service is still on Render's **free plan**
(`plan: free` in `render.yaml`) while PayPal is **live**. What the owner should decide, in this order:

1. **Render Starter (about US$7 a month) before relying on live payments.** The free plan sleeps after 15 minutes
   without traffic (30-60 s to wake, section 2.1); the keep-alive job hides it most of the time, but a customer who meets
   a sleeping API at "Pay" is a lost sale, and the free plan has no guarantee.
2. **Put the API next to the database: a new Render service in Frankfurt** (Render cannot move a service; steps in
   point 3 below), then the Netlify function region to `eu-central-1` (Netlify -> Site configuration -> Functions ->
   Region) so the site's server, the API and the database are on one continent. Expected: the 143 ms per database call
   drops to a few ms, and an API answer to roughly the 60-80 ms of the network from Israel or Europe. US visitors pay
   about 90-100 ms more per uncached API call, which the site's data cache hides for page views.
3. Optional, once 1-2 are done: if API answers should be cached at the edge, give the API its own domain behind a CDN with a
   cache rule for `catalog`, `getNProducts` and `live/schedule` (they already send `s-maxage`). The website itself
   caches the catalogue for 10 minutes in Next's data cache, so this mainly helps the browser's own calls.

| Part | Region today | Evidence |
|---|---|---|
| Render API | **Oregon** (US West) | `render.yaml` (`region: oregon`) |
| MongoDB Atlas | **unknown (owner)**: Atlas -> the cluster -> Configuration. After the next API deploy, `/health/deep` shows `database.latencyMs`: single or low double digits = same region as Render, 100+ ms = another continent |
| Netlify functions (SSR) | **unknown (owner)**: Netlify -> Site configuration -> Functions -> Region. The default is US East |
| Netlify edge / DNS answers | Frankfurt addresses; static files and the CDN are global |
| Visitors | pilgrims from the USA, Europe and Israel/Arab world (14 languages) |

Approximate distances (round-trip, physics plus routing, **estimates, not measured**): Israel to Oregon 200+ ms (measured
220 ms above), Israel to Frankfurt 60-80 ms, US East to Oregon 60-70 ms, Europe to Oregon 140-160 ms.

Advice, in order of value:
1. **Keep Render, Atlas and the Netlify function region together** whatever the choice: each page that misses the cache
   makes several API calls, and each API call makes several database calls; a transatlantic hop in the middle of that chain
   is paid many times. If Atlas and Render are in different continents, that is the first thing to fix (move Atlas, it is
   the easier of the two: Atlas lets you change the cloud region of a paid cluster; the free cluster must be recreated and
   restored from a dump).
2. **Frankfurt (`eu-central`) for all three** is the best single choice if most visitors are in Israel, Europe or the
   Arab world (Frankfurt is 3 times closer to Israel than Oregon); US visitors then pay about 90-100 ms more than from
   Oregon, which a cached, server-rendered page hides. **US East (Virginia/Ohio)** is the middle road if the USA is the
   largest audience. Oregon is the worst fit for both. The audience mix is the owner's number: look at Netlify Analytics or
   the sitemap/search console country report.
3. Render cannot move an existing service to another region: create a **new** service in the chosen region from the same
   repository, copy the environment variables, test on its `onrender.com` address (`ops/smoke-live.mjs --api <new url>`),
   then change `NEXT_PUBLIC_API_URL` on Netlify and rebuild, then delete the old one. Cost: none beyond the work; risk:
   medium (do it outside the shop's busy hours; PayPal and CORS settings are unaffected).
4. Do not chase this before the cold start and the Atlas region are known: a sleeping API (40 s) is 200 times worse than
   an ocean (0.2 s).

### 2.5 Rate limits behind Cloudflare (a finding)

Every request to the API passes through **Cloudflare** (`CF-RAY`, `Server: cloudflare`) and then Render's own proxy. The
server counts requests per client address using Express `trust proxy` = 1 (one proxy: take the last `X-Forwarded-For`
entry). Measured: eight requests from this one PC to `/health` were counted in **at least three different buckets**
(the `RateLimit` header showed different `remaining` and `reset` values, even going **up** between calls), while a forged
`X-Forwarded-For: 203.0.113.x` did **not** open a fresh bucket. Inference (not seen inside the server): the "address" being
counted is a **Cloudflare edge address**, so every visitor that reaches Render through the same edge address shares one
counter, and the 5-failed-logins, 10-forms, 30-payment-calls and 200-requests limits protect (and annoy) the wrong
people. Today's traffic is low enough not to notice; it grows with the site.

**Fix (code is in; default behaviour unchanged):** the environment variable `TRUST_PROXY_HOPS` (whole number 1-5, default 1)
now sets `trust proxy`. Procedure for the owner, any quiet time, 10 minutes:
1. Render -> `nazareth-holy-cross-api` -> Environment -> add `TRUST_PROXY_HOPS` = `2` -> save (the service redeploys).
2. Test from your own PC: run `curl -s -D - -o /dev/null https://nazareth-holy-cross-api.onrender.com/health | findstr /i ratelimit`
   six times. **Good:** `remaining` goes 199, 198, 197... and `reset` is nearly the same in every answer (one bucket).
   **Then** run it with `-H "X-Forwarded-For: 203.0.113.9"`: still the same bucket (a forged header must not matter).
3. If the numbers are still scattered, or `remaining` jumps, set the variable back to `1` (or delete it) and tell the
   developer: the proxy chain is longer than assumed, and the real client address may need the `CF-Connecting-IP` header.
Never set it higher than the real number of proxies: too high lets a visitor choose their own address with a forged header.

### 2.6 Other API observations

- Security headers on the API: CSP `default-src 'none'`, HSTS 2 years + preload, `nosniff`, `no-referrer`, frame deny, CORP
  same-origin. Good.
- `/product/catalog` is 84 KB uncompressed (`Transfer-Encoding: chunked`; check whether Render's proxy compresses: the
  `Content-Encoding` header was not present in a plain request).
- `render.yaml` lists the variables Render needs, with `sync: false` for secrets; `TRUST_PROXY_HOPS` is optional and set
  only in the dashboard.

## 3. Netlify

### 3.1 `netlify.toml` (public site) reviewed

| Setting | Value | Assessment |
|---|---|---|
| `base`, `command`, `publish` | `web`, `npm ci && npm run build`, `.next` | correct for Next on Netlify |
| `NODE_VERSION` | 22 | matches CI |
| Plugin | `@netlify/plugin-nextjs`, named explicitly | **essential** (section 5.1 of MONITORING.md; a test guards it). Unpinned: Netlify uses its current version, which is how it stays compatible with Next 16 |
| Headers | `/_next/static/*` immutable; `/sw.js` no-store; **new:** `/images/*`, `/images/nazareth-media/*`, `/videos/*`, `/sounds/*` (the `/_next/image*` experiment was removed on 2026-10-07: Netlify ignored it, 3.4) | see 1.6 |
| Redirects | **new:** `nazarethholycross.netlify.app/*` -> the real domain, 301, that exact host only; since 2026-10-07 also `http://www.nazarethholycross.com/*` -> `https://nazarethholycross.com/:splat`, 301, one hop | previews and branch deploys keep working |
| 404 | handled by Next (`not-found`), `noindex`, not cacheable | good |
| Legacy URLs of the old site (`/latin`, `/product/:id`, `/checkoutcandle`, `/checkoutdonation`) | since 2026-10-07 one 308 from `src/proxy.ts` to `/<language>/…`; the language-prefixed forms (`/en/latin`) by `redirects()` in `next.config.ts`, 308 | proven by `tests/unit/legacy-redirects.test.ts`; `smoke-live` follows `/latin` and `/checkoutcandle` live |
| Headers and redirects handled by whom | **Netlify:** TLS, http->https and www->apex, static-file headers, the `netlify.app` redirect. **Next:** every security header, the CSP nonce, the language redirect, legacy redirects, `trailing slash` (308) | split is sensible; the only gap was HSTS on Netlify's redirects (1.5) |

### 3.2 Build time

Netlify's own log is not readable from here (**owner**: Deploys -> a deploy -> Deploy log). From GitHub's statuses: the deploy
preview of PR #21 went from "processing" (21:02:13) to "ready" (21:02:56): **about 43 seconds** (a warm dependency cache).
A cold build of `web/` on a developer PC is longer; the CI "Web" job (build plus 600+ browser tests) takes about 16 minutes,
which is the test, not the deploy.

### 3.3 Where pages are rendered

Every page is rendered per request (the CSP nonce forbids caching HTML, `docs/SECURITY.md` 3.1), by a Netlify **function**.
Measured server wait 250-650 ms per page from Israel. That time is mostly the function plus the API reads that miss the
cache. The function **region** (owner: Site configuration -> Functions -> Region) should be the one that is closest to
Render and Atlas (2.4). Nothing in `netlify.toml` sets it. Expect no change before the region question is settled.

### 3.4 Image CDN (`/_next/image`) and static files

`next/image` on Netlify is served by Netlify's Image CDN (`Netlify-Vary: ... Netlify-Image-Accept`). Measured on the live site,
the same Firebase product photo (`w=640`, WebP, 40 KB) six times in a row: **always 200 and 1.0-1.4 s**, `Cache-Control:
private,max-age=0`, `Cache-Status: "Netlify Edge"; fwd=miss`, and a conditional request (`If-None-Match`) is a 304 that
also takes 1.1 s. So an image is neither kept by the browser nor served from the edge; a product page with ten photos
asks ten times. The pre-built photos in `public/images/nazareth-media` (AVIF/WebP written by `scripts/media`) do not have
this problem once the headers of 1.6 are live: they are plain files.

**Result (2026-10-07): the experiment failed.** Measured on production by review 05: the same `/_next/image` photo three
times in a row, 200 each, 1.41 / 1.93 / 1.41 s, still `Cache-Control: private,max-age=0`, `Cache-Status: "Netlify Edge";
fwd=miss` then `fwd=stale`, and WebP although the browser accepts AVIF. Netlify's Image CDN follows the caching of the
**original** (Firebase serves the product photos with `private, max-age=0`) and ignores a `[[headers]]` rule for
`/_next/image`. The rule was removed from `netlify.toml` (branch `fix/perf-seo-a11y`); the fix is fix (a) below, an owner
step written out in `docs/PERFORMANCE.md` section 10.4. The text that follows is the original plan, kept for the record.

Done: the rule for `/_next/image*` in `netlify.toml` (1 day + stale-while-revalidate). **It is an experiment**: Netlify may
apply it or may ignore it for image requests. **How to check on a deploy preview** (the pull request of this change):
```bash
curl -sI "https://<preview>/_next/image?url=<the same encoded Firebase url>&w=640&q=75" -H "accept: image/webp" | grep -i -E "cache-control|cache-status"
curl -sI https://<preview>/images/nazareth-media/basilica-dome-palms/1280.avif | grep -i cache-control
```
Expected: `public, max-age=86400...` on both. If the first still says `private,max-age=0`, the fixes in order of effort:
(a) **set long `Cache-Control` metadata on the Firebase objects** (`gsutil setmeta -h "Cache-Control:public,max-age=31536000"`):
Netlify's Image CDN honours the origin's caching for how long it keeps a transformed copy, and the photo URLs carry a
download token that changes with the file; (b) serve product photos at fixed sizes straight from Firebase (a custom
`loader` in `next.config.ts`, no transformation), accepting bigger files; (c) a paid Netlify plan is not the answer.
Re-measure with the six-request loop above; do not trust this section without a number.

### 3.5 Environment variables, and PayPal sandbox vs live

**Public site (Netlify -> Site configuration -> Environment variables).** Everything is `NEXT_PUBLIC_*`, **inlined into the
JavaScript at build time**: changing a value changes nothing until a new deploy.

| Variable | Used by | Default in `web/src/lib/config.ts` | Production today |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | canonical URLs, sitemap, Open Graph | `https://nazarethholycross.com` | relies on the default (correct) |
| `NEXT_PUBLIC_API_URL` | every API call, CSP `connect-src` | `https://nazareth-holy-cross-api.onrender.com` | relies on the default (correct: the CSP of the live site names it) |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | the PayPal button | **the sandbox client id** | **relies on the default: the live bundle contains the sandbox id** (found by reading the live JavaScript; first 8 characters `AfhOc9To`). The shop's payments are therefore **PayPal sandbox payments, not real money** |
| `NEXT_PUBLIC_WHATSAPP` | contact page link | empty (link hidden) | not set |

Relying on defaults is dangerous exactly where it matters: a forgotten variable on the Live switch silently keeps the
sandbox id. **Set all four explicitly** for the Production scope (Netlify lets a variable apply to "Production" only, so deploy
previews keep using sandbox and the preview API).

**Render** (`render.yaml`): `DATABASEURL`, `JWT_SECRET` (32+ chars), `ADMIN_PASSWORD`, `MAIL_FROM`, `MAIL_APP_PASSWORD`,
`CLIENT_ID`, `CLIENT_SECRET` (PayPal REST), `ENVIRONMENT` (`sandbox` unless `production`), `CLIENT_URL`, `ADMIN_ORIGINS`,
`REQUIRE_PAYMENT_PROOF`, optional `EXTRA_ORIGINS`, `TRUST_PROXY_HOPS`, and for live broadcasting `CF_ACCOUNT_ID`,
`CF_STREAM_API_TOKEN` (Cloudflare Stream; LIVE.md section 6). `/health/deep` reports `paypalMode` so the API side can
be read without a login.

#### Checklist: switching PayPal to Live safely (owner; an agent never presses a live pay button)

The API's `ENVIRONMENT`, `CLIENT_ID`, `CLIENT_SECRET` and the site's `NEXT_PUBLIC_PAYPAL_CLIENT_ID` must be **all Live or all
Sandbox**. A mix fails closed (PayPal refuses the order, nobody is charged) but breaks the checkout.

1. [ ] The PayPal **Business** account is verified (identity, bank account, the website address), has two-factor sign-in,
       receives USD, and its business name matches the site and the legal pages (`docs/TODO-LEGAL.md`: return window, legal
       entity, governing law are still **open owner decisions**; PayPal reviews the site).
2. [ ] developer.paypal.com -> Apps & Credentials -> **Live** -> create an app. Keep the Live *Client ID* and *Secret*
       out of chat, e-mail and the repository.
3. [ ] **Webhook.** None exists (`docs/SECURITY.md` section 7): a customer who pays and closes the browser before the order
       is saved leaves a payment without an order. Either build the webhook first, or accept manual reconciliation: **every
       day, compare PayPal -> Activity with the orders in the dashboard** until it exists.
4. [ ] Pick a quiet hour. Render: set `ENVIRONMENT=production`, `CLIENT_ID=<Live client id>`, `CLIENT_SECRET=<Live secret>`
       together, save (redeploy). Check `https://nazareth-holy-cross-api.onrender.com/health/deep` says `"paypalMode":"live"`.
5. [ ] Netlify (Production scope): `NEXT_PUBLIC_PAYPAL_CLIENT_ID=<Live client id>`; then **Deploys -> Trigger deploy -> Clear cache
       and deploy site** (the value is read at build time). Do 4 and 5 within a few minutes of each other.
6. [ ] `node ops/smoke-live.mjs`: the line "API PayPal mode" must be a PASS with `live` (it is a WARN while `sandbox`).
7. [ ] **One real payment by the owner**, the smallest (a US$3 candle) with his own card, from a phone, by hand. Then in
       PayPal -> Activity: the payment, its fee, **refund it**. Check the order record shows `paymentVerified: true` and the
       e-mail arrived. If the order is missing, the payment was captured but `newOrder` failed: read the Render log for the
       PayPal order id.
8. [ ] `REQUIRE_PAYMENT_PROOF=true` on Render (the old site that did not send `paypalOrderId` is retired): orders
       without a verified payment are then refused.
9. [ ] Watch for a week: PayPal e-mails, the monitors (MONITORING.md), the Render log for `payment` errors.
10. [ ] **Rollback** (any problem): Render `ENVIRONMENT=sandbox` + the sandbox `CLIENT_ID`/`CLIENT_SECRET`; Netlify variable back
        to the sandbox id (or delete it) and "Clear cache and deploy site". Nobody is charged real money in sandbox.
11. [ ] Rotate the Live secret if it ever appears anywhere it should not (PayPal -> the app -> Secret -> regenerate; update Render).

The CSP already allows `*.paypal.com` and `*.paypalobjects.com` (live and sandbox use the same hosts), and the
`Permissions-Policy` allows `payment` for PayPal, so no code change is needed to go Live.

## 4. What this audit changed in the repository

Nothing was changed on GoDaddy, Netlify, Render, Atlas, Firebase, PayPal or GitHub. In the repository (all of it takes
effect only after the owner merges and deploys, and all of it is guarded by tests where a test can see it):

| Change | Where |
|---|---|
| `GET /health/deep` (database ping with a deadline, uptime, version, PayPal mode, no secrets); health checks on their own rate-limit counter | `server/services/health.js`, `server/app.js`, `server/utils/security.js`, `server/__tests__/health.test.js` |
| `TRUST_PROXY_HOPS` (default 1 = unchanged) | `server/config/env.js`, `server/app.js`, `server/__tests__/config.test.js` |
| Cache headers for `public/` files, the experiment for `/_next/image`, the `netlify.app` redirect, telemetry off | `netlify.toml`, guarded by `web/tests/unit/netlify-config.test.ts` |
| Full HSTS on the language redirect (preload eligibility) | `web/src/lib/hsts.ts`, `web/src/proxy.ts`, `web/next.config.ts`, `web/tests/unit/proxy.test.ts` |
| `/.well-known/security.txt` | `web/public/.well-known/security.txt` |
| Keep-alive job | `.github/workflows/keepalive.yml` |
| Post-deploy smoke test | `ops/smoke-live.mjs` (mandatory step in `docs/ENGINEERING.md` section 3) |
| Repository hygiene: `README.md`, `.gitattributes`, `.editorconfig`, `CODEOWNERS`, issue templates, `SECURITY.md` | repository root, `.github/` |
| Firebase rules and CORS copies | `ops/firebase/` |
| This document, `MONITORING.md`, `REPOSITORIES.md`; one row added to `docs/SECURITY.md` section 7 | `docs/` |

## 5. Owner checklist from this audit, in order

| # | Action | Where | Risk |
|---|---|---|---|
| 1 | Create the uptime monitors (MONITORING.md section 2), starting with `/health/deep` | UptimeRobot / Better Stack | none |
| 2 | GoDaddy auto-renew + two-factor (1.8 #1-2); two-factor on Netlify, Render, Atlas, GitHub, PayPal, Google | each service | none |
| 3 | Deploy this branch (after review), then run `node ops/smoke-live.mjs`, and check the three header experiments (1.5, 1.6, 3.4) | merge, then curl | low |
| 4 | Look up the Atlas region and the Netlify function region; read `/health/deep` `database.latencyMs` | Atlas, Netlify | none |
| 5 | `TRUST_PROXY_HOPS=2` test (2.5) | Render | low (reversible) |
| 6 | Atlas: confirm a backup exists (6.1) | Atlas | none |
| 7 | Set the four `NEXT_PUBLIC_*` variables explicitly (3.5) | Netlify | low |
| 8 | Netlify DNS: SPF `-all` and DMARC (1.8 #4-5) | Netlify DNS | low |
| 9 | GitHub settings of REPOSITORIES.md section 4 | GitHub | low |
| 10 | Decide region (2.4: Atlas is in Frankfurt, the API in Oregon, 143 ms per database call) and, since PayPal is live, a paid Render instance (Starter) | Render, Netlify | medium |
| 12 | Set long `Cache-Control` on the product photos in Firebase (`docs/PERFORMANCE.md` 10.4) | Firebase / Google Cloud | low |
| 11 | PayPal Live checklist (3.5) | PayPal, Render, Netlify | medium |

## 6. Database, backups, Firebase

### 6.1 MongoDB Atlas (checked in the Atlas console, read-only, 2026-10-06)

**Facts.** Organisation `SaherSaadi` (owner: Saher; member: Haytham Taweel, last login 03/2025). Production is the project
**Nazareth-Holy-Cross** (renamed from "Nazareth-Holly-Cross" on 06/10), cluster **Cluster0**, database **`info`**:
**M10 dedicated**, MongoDB 7.0, AWS **Frankfurt (eu-central-1)**, 3-node replica set, **Cloud Backup ON** (hourly, daily and
weekly snapshots, seen in the activity feed for the whole last 30 days), about 84 KB of data. Network Access: `0.0.0.0/0`
only (since 05/10; access is protected by the database users). Database users: `haythamtaweel95` and `sahersaadi`, both
`atlasAdmin` (one of them is in Render's `DATABASEURL`: never change their passwords without updating Render first). The same
project also holds a FREE cluster `memory-map` (Bahrain, another app, not this site). A separate project **Holy Cross** has a
FREE Cluster0 with an empty IP access list (nothing can connect: not in use). Billing: about $13 so far in October, $76.68
of usage in September (M10 + backup); the cluster is far larger than an 84 KB database needs, see the cost note below.

**Cost note (owner decision).** M10 is the smallest tier with continuous cloud backup and point-in-time restore. A Flex
cluster would cost much less and still has daily snapshots, M0 is free but has no backup at all. Going down from a dedicated
tier may not be possible in place: it can mean a new cluster, moving the data (backup.js / restore.js) and a new
`DATABASEURL` on Render (Haytham's account), so check in Atlas (*Edit configuration*) before deciding; decide with BACKUP.md section 5 and keep `server/scripts/backup.js` either way.

The bullets below were written before this check, from outside:


- **Backups.** The free (M0) cluster has **no automatic backup** (Atlas -> the cluster -> *Backup*: it is empty or disabled for
  M0). "Nothing is ever lost" needs one of: a paid cluster with Cloud Backup (M10 and up, point-in-time), or a scheduled
  `mongodump` of the production database to a place the owner controls (for example weekly, to an encrypted folder or
  private cloud storage, keeping 8 copies). Neither exists in the repository: a dump needs the production connection
  string, which this audit must not touch. **Owner:** check the Backup tab today; if it says "not available", this is
  the single most valuable item of this document.
- **Network Access** (the failure of MONITORING.md 5.2): a free Render service has no fixed address, so the list is
  `0.0.0.0/0` or Render's published outbound ranges. Check which, and that nothing else is open.
- **Users.** One database user for the API with `readWrite` on the one database only; a different, human user for the owner's
  `create-admin` run; no `atlasAdmin` user in the API's connection string.
- **Alerts** (Project -> Alerts): connections, storage near 512 MB, cluster down, to the owner's e-mail.
- **Indexes/TTL** the dashboard needs (`adminSession`, `auditLog`): ADMIN-RUNBOOK.md section 6.
- **Region:** 2.4.

### 6.2 Firebase Storage

Holds the product photos and the long videos (bucket `nazareth-holy-cross.appspot.com`). The rules and CORS file lived only
in the old public client repository; copies are in `ops/firebase/` with their README. The copy says: **anyone reads,
any signed-in Firebase user writes**. Safe only if **no sign-in method** is enabled in Firebase Authentication (Console ->
Authentication -> Sign-in method: all disabled, Anonymous too). Otherwise a stranger can create a user and fill the bucket.
The deployed rules were not seen; compare them with the copy and tighten as `ops/firebase/README.md` describes. Set long
`Cache-Control` metadata on photos (section 3.4). Firebase's free tier has download quotas: watch Usage if the video
traffic grows (videos over 8 MB are served from here by design).
