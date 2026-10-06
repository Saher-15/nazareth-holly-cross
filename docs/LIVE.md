# Live broadcasting

An editor or owner opens **Live broadcast** in the admin dashboard, turns on the camera of their phone or computer,
writes a title and presses **Go live**. Within seconds the public page `/<language>/live` shows the broadcast above the
schedule, with a "Live now" badge, the title and how long it has been on. **End broadcast** takes it off again.

The video goes from the browser straight to **Cloudflare Stream** (WebRTC: WHIP in, WHEP out); our API only creates
and deletes Cloudflare's "live input" and keeps a small record of each broadcast. Nothing else (no OBS, no app, no
streaming server of our own) is needed.

Code: `server/services/cloudflareStream.js`, `server/services/live.js`, `server/route/admin/live.js`,
`server/route/liveRoute.js`, `server/model/liveSession.js`; `admin/src/app/(app)/live/`, `admin/src/lib/whip.ts`,
`admin/src/lib/media.ts`; `web/src/components/community/LiveNow.tsx`, `web/src/lib/liveStatus.ts`,
`web/src/lib/liveStatusPeek.ts`. Cloudflare's documentation: [WebRTC (beta)](https://developers.cloudflare.com/stream/webrtc-beta/)
and [live inputs](https://developers.cloudflare.com/stream/stream-live/).

## 1. How it works

```
admin's browser (dashboard /live)          our API (Render)                    Cloudflare Stream
  camera + microphone (getUserMedia)
  POST /api/proxy/live/start {title} ----> POST /admin/live/start
                                             POST /accounts/:id/stream/live_inputs ----> new live input
                                             <---- uid, webRTC.url (WHIP, secret), webRTCPlayback.url (WHEP)
                                             saves LiveSession {title, inputUid, whepUrl}   (NOT the WHIP url)
  <---- 201 {session, whipUrl}  (only to this admin, only in this answer)
  WHIP: POST SDP offer to whipUrl  ---------------------------------------------> 201 SDP answer + Location
  WebRTC media (sub-second) ------------------------------------------------------> 
                                                                                    WHEP / Stream player
visitor's browser (web /live)
  GET /live/status every ~15 s  ---------> { live, title, startedAt, playbackUrl } (5 s memory cache)
  <iframe src=playbackUrl>  (Cloudflare's player page; it plays WHEP by itself) <---- video
  
  End broadcast: WHIP DELETE (Location) + POST /admin/live/stop -> DELETE the live input; LiveSession ended
```

* **One broadcast at a time.** The database allows only one `liveSession` with status `live` (a partial unique index),
  so two people pressing Go live at the same moment get one broadcast and one "another broadcast is live" message.
* **Who can end it.** The person who started it; an owner can end anyone's after confirming (`force`). It also ends
  **by itself after 6 hours** (`LIVE_MAX_MS`): on the next status read, and by a timer in `server/index.js` every
  10 minutes. The dashboard sends a keepalive "stop" when the page is closed or reloaded, and ends the session at once
  if the camera cannot connect to Cloudflare, so the website never shows an empty player for long.
* **The public status** comes from the API's memory for 5 seconds and carries `Cache-Control: public, max-age=5`. The
  website's server peeks at it (at most every 15 seconds per server, never waiting for it) to put a small dot on the
  header's Live link; the `/live` page polls it about every 15 seconds while it is visible (not while hidden, slower
  after failures, as slow as a `Retry-After` asks). The first poll waits until the server's own answer is 15 seconds
  old, so a quick visit costs the API nothing.
* **The player** is Cloudflare Stream's own player page (`https://customer-<code>.cloudflarestream.com/<input id>/iframe`,
  derived by the API from the WHEP address), in an `<iframe>` with a title. Cloudflare's player "automatically upgrades
  to WHEP" for WebRTC inputs; it has its own play, pause, volume and full-screen controls. It does not autoplay.

## 2. API

Full contract: [ADMIN.md](ADMIN.md) section 4.6. In short:

| Route | Who | Answer |
|---|---|---|
| `GET /admin/live` | editor, owner | `{ configured, maxMinutes, current, history }` (10 most recent) |
| `POST /admin/live/start { title }` | editor, owner | `201 { session, whipUrl }`; `409` while one is live; `503` not configured; `502` Cloudflare refused |
| `POST /admin/live/stop { sessionId?, force? }` | editor, owner | `{ stopped, session }`; `403` someone else's (editor); `409` someone else's (owner without `force`) |
| `GET /live/status` | anyone | `{ live: false }` or `{ live: true, title, startedAt, playbackUrl }` |

Audit: `live.start`, `live.stop` (with `reason`: `stopped` or `forced`, and the minutes), `live.auto_end`,
`live.start_failed`.

**Scheduled broadcasts on the website's calendar.** The Christian calendar of `/live` (`docs/LITURGICAL-CALENDAR.md`)
also shows the broadcasts scheduled in the dashboard, read on the server from `GET /live/schedule`
(`{ timeZone, items: [{ id, title, description, startsAt, status }] }`, published and still to come) by the adapter
`web/src/lib/broadcastSchedule.ts`: a mark on the day (in Nazareth time), the time and description on the chosen day,
"add to calendar" (an exact instant, one hour long) and a schema.org `Event` per broadcast. Until the API has the route
it answers 404 and the calendar shows no broadcasts (it asks again 10 minutes later).

## 3. Security

| Concern | Decision |
|---|---|
| The WHIP address holds the input's broadcast secret (anyone with it can broadcast on our page) | Returned **once**, in the answer to `start`, to the admin who started it. Never stored (not in `liveSession`), never in another answer, never logged (tested: database, answers, audit log and log lines are searched for it). The dashboard keeps it in memory only and never sends cookies to Cloudflare (`credentials: 'omit'`, no referrer). |
| The Cloudflare API token | `CF_STREAM_API_TOKEN` on Render only (`sync: false`), sent only in the `Authorization` header to `api.cloudflare.com`; error messages carry Cloudflare's status and error codes, never the token or an address it returned. A token with **Stream: Edit** for the one account is enough. |
| What Cloudflare answers | Checked before use: the WHIP and WHEP addresses must be `https://customer-<code>.cloudflarestream.com/.../webRTC/publish|play`, the input id 32 hex. The website frames only `https://customer-<code>.cloudflarestream.com/<32 hex>/iframe` (anything else counts as "not live"). |
| Dashboard CSP | `connect-src https://*.cloudflarestream.com` **only on `/live`** (`admin/src/proxy.ts`); `media-src 'none'` stays (the preview uses `srcObject`, which is not a URL load). |
| Camera and microphone | `Permissions-Policy: camera=(self), microphone=(self), autoplay=(self)` **only on `/live`** (`admin/next.config.ts`); every other dashboard page keeps them off. A browser applies the policy of the page it loaded, so the menu opens `/live` with a full page load, and the page explains (with a Reload button) if it was reached another way. |
| Website CSP | `frame-src https://*.cloudflarestream.com` (`web/src/lib/csp.ts`); `connect-src`, `script-src`, `img-src` unchanged. `Permissions-Policy` lets that origin use full screen, picture-in-picture and autoplay inside the frame. |
| Roles | Editor and owner on every route (`requireRole('editor')`), viewer 403 (tested in the role matrix). An editor cannot end someone else's broadcast; an owner must confirm. |
| Abuse of the public status | Its own rate limit (3000 per 15 minutes per address, about 50 viewers behind one address) instead of the general 200; answered from memory. |
| The old room routes | `POST /live/create_room`, `GET /live/room_id`, `POST /live/close_room` (one id kept in the process memory, readable by anyone) were **removed**: no page of `web/` or `admin/` used them. The abandoned `client-next/` read `room_id`; the old admin site (separate repository) may still call `create_room` and now gets 404, which changes nothing for visitors. |

## 4. Costs

* Cloudflare Stream bills WebRTC by **minutes delivered: 1 US dollar per 1,000 minutes watched** (billing for WebRTC
  delivery starts 15 October 2026, per Cloudflare's page). Nothing is stored (WebRTC is not recorded), so there is no
  storage cost. Example: a 45-minute prayer watched by 40 people = 1,800 minutes = about 1.80 USD.
* The Stream subscription itself: see [Stream pricing](https://developers.cloudflare.com/stream/pricing/) when
  subscribing (the owner decides the plan).
* Our API: one small database row per broadcast; the status poll is answered from memory.

## 5. Limits

* **No recording, no HLS/DASH, no viewer counts, no simulcast** in WebRTC mode (Cloudflare's beta). Only the people
  watching at that moment see it. The schedule's past broadcasts below stay as they are.
* WebRTC is a **beta** at Cloudflare; the API shape used here was taken from their documentation on 2026-10-06.
* One broadcast at a time; 6 hours at most; 120 characters of title.
* The admin's browser must stay on the page: leaving it ends the broadcast. On a phone the screen is kept on (Wake
  Lock) where the browser allows it; a phone call or a locked screen interrupts the camera.
* Up to about 2.5 Mbit/s of video upload (720p, 30 frames): Wi-Fi recommended.
* The header's "live now" dot is a snapshot from when the page was loaded (up to about 15 seconds old); the `/live`
  page itself follows the broadcast.

### Adding recording later

WebRTC inputs cannot be recorded. For a recorded broadcast use Cloudflare's other ingest: create the live input with
`recording: { mode: "automatic" }` and publish with **RTMPS or SRT** from OBS (or a phone app such as Larix): the
input's `rtmps.url` and `rtmps.streamKey` go into OBS > Settings > Stream. Viewers then watch HLS (a few seconds of delay
instead of under one) in the same Stream player, and each broadcast becomes a video in Stream that can be replayed.
That needs a second mode in `server/services/cloudflareStream.js` (the RTMPS details shown to the admin once, like the
WHIP address now) and a "past broadcasts from Stream" list; storage is then billed per minute stored.

## 6. Owner set-up (once)

1. **Cloudflare account.** Sign up at https://dash.cloudflare.com (or use an existing one). Turn on two-factor sign-in.
2. **Stream.** Dashboard > Stream > subscribe (a payment method is needed; Stream is billed separately).
3. **API token.** My Profile > API Tokens > Create Token > Custom token: permission **Account > Stream > Edit**, account
   resources: **only this account**, no IP filtering needed, an expiry date you will remember. Copy the token once.
4. **Account id.** Dashboard > the account's overview page, right column: "Account ID".
5. **Render.** Service `nazareth-holy-cross-api` > Environment > add `CF_ACCOUNT_ID` and `CF_STREAM_API_TOKEN` (both
   are listed in `render.yaml` with `sync: false`, so Render asks for them and never shows them in the repository) >
   Save, which redeploys. The start-up log then says `live broadcasting: configured`.
6. Never paste the token into a chat, an e-mail or the repository; if it ever leaks, delete it in Cloudflare and
   create a new one (step 3), then update Render.

Without the two variables the dashboard's Live page says "Live broadcasting is not set up yet" and nothing else changes.

## 7. The first broadcast (test it once, privately)

1. After the deploy, sign in to the dashboard as an editor or owner, on a **phone** (that is how most broadcasts will be
   made) on Wi-Fi.
2. Menu > **Live broadcast** > **Turn on camera and microphone**: allow both when the browser asks. The preview shows
   you (mirrored, like a mirror; viewers see you the right way round). Try **Switch camera** and the microphone list.
3. Title: "Test, please ignore" > **Go live**. Within a few seconds: the red **Live** badge with a running time and
   "You are live".
4. On a second device open `https://nazarethholycross.com/en/live`: within about 15 seconds the player appears above the
   schedule; press play. Check sound, delay (should be under a second), full screen, and the dot on the header's Live
   link (after a reload).
5. **End broadcast** > confirm. The website removes the player within about 15 seconds. The dashboard's "Recent
   broadcasts" shows the test as "Ended"; the owner's Audit log shows `live.start` and `live.stop`.
6. In Cloudflare > Stream > Live inputs, the input of the test is gone (deleted by the API). If it is still there, the
   Render log has a line `[live] could not delete the Cloudflare live input <id>`: delete it by hand.

If the phone says the camera was refused: browser settings for the dashboard's site > Camera and Microphone > Allow,
then reload. On iPhone: Settings > Safari > Camera / Microphone > Ask or Allow.

## 8. Tests and what is not verified

* `server/__tests__/live.test.js`: the Cloudflare client against a fake `fetch` (request shape, token only in the
  header, error handling, address checks), the routes against a fake Cloudflare client
  (`server/test-harness/fake-cloudflare.js`): start, the single-session rule and the race, stop (own, someone else's,
  owner with force, repeated, a late stop after a newer start), Cloudflare failures, the automatic end, roles, the
  public status and its cache and rate limit, the WHIP address appearing nowhere else, and the removed room routes.
  The role matrix (`admin-roles.test.js`) includes the three dashboard routes.
* `admin/tests/unit/live.test.ts`: the WHIP client against a fake `RTCPeerConnection` and `fetch` (offer, answer,
  Location on the same host only, DELETE on stop, reconnecting, errors without the address), the camera helpers, the
  CSP and Permissions-Policy of `/live`, the proxy allow-list, roles. `admin/tests/unit/parity.test.ts` runs the live
  steps against the mock and the real API.
* `admin/tests/e2e/live.spec.ts` (mock and harness): a fake camera and microphone in Edge, the page's real WHIP client
  against a WebRTC peer inside the same page (no network, no STUN), going live, the website's status, mute, ending, the
  keepalive stop on leaving, Cloudflare refusing, a refused permission, someone else's broadcast, not configured,
  the viewer's 403, axe on desktop and phone, Hebrew.
* `web/tests/unit/liveNow.test.tsx` and `web/tests/e2e/live-broadcast.spec.ts`: the status parsing, polling cadence,
  hidden page, back-off, the player appearing and disappearing, only Cloudflare's player framed, announcements, RTL,
  a 360 px phone, axe.

**Not verified (no Cloudflare account exists yet):** a real Cloudflare API answer (the shape is taken from the
documentation), a real WHIP session with Cloudflare (Location header, CORS, ICE through STUN), Cloudflare's player
page playing WHEP inside our frame (and whether it needs more than the `allow` list we give it), the
`Permissions-Policy` wildcard for `*.cloudflarestream.com` in every browser, real phones (Safari on iPhone, Chrome on
Android: camera prompts, switching cameras, Wake Lock), and the delivered-minutes billing. Section 7 checks all of
these in ten minutes once the account exists.
