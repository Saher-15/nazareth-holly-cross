# Live broadcasting

An editor or owner opens **Live broadcast** in the admin dashboard, turns on the camera of their phone or computer,
writes a title (or picks the scheduled broadcast it fulfils) and presses **Go live**. Within seconds the public page
`/<language>/live` shows the broadcast with a "Live now" badge, the title and how long it has been on; every page of the
website shows a red dot on the header's **Live** link, and visitors on other pages see a small "We are live now"
window once. **End broadcast** takes it off again; the browser then uploads its **recording** of the broadcast to
Cloudflare, and the admin can **publish** it among the past broadcasts of `/live`. Broadcasts can be **scheduled**
ahead: the website shows the next one with a countdown.

The video goes from the browser straight to **Cloudflare Stream** (WebRTC: WHIP in, WHEP out; recordings by a one-time
tus upload); our API only creates and deletes Cloudflare's "live input", asks Cloudflare for upload addresses, and keeps
a small record of each broadcast, recording and scheduled broadcast. Nothing else (no OBS, no app, no streaming server
of our own) is needed, and the API never sees a byte of video.

Code: `server/services/cloudflareStream.js`, `server/services/live.js`, `server/services/liveRecordings.js`,
`server/services/liveSchedule.js`, `server/route/admin/live.js`, `server/route/admin/liveRecordings.js`,
`server/route/admin/liveSchedule.js`, `server/route/liveRoute.js`, `server/model/{liveSession,liveRecording,scheduledBroadcast}.js`;
`admin/src/app/(app)/live/` (`LiveStudio.tsx`, `RecordingUploads.tsx`, `LiveRecordings.tsx`, `LiveSchedule.tsx`),
`admin/src/lib/whip.ts`, `admin/src/lib/media.ts`, `admin/src/lib/recorder.ts`, `admin/src/lib/recording-store.ts` (IndexedDB),
`admin/src/lib/recording-upload.ts`, `admin/src/lib/tus.ts`, `admin/src/lib/schedule.ts`; on the website
`web/src/lib/liveStatusStore.ts` + `web/src/lib/useLiveStatus.ts` (the shared poller), `web/src/lib/liveStatus.ts`,
`web/src/lib/liveStatusPeek.ts`, `web/src/lib/liveAlert.ts`, `web/src/lib/liveSchedule.ts`, `web/src/lib/liveRecordings.ts`,
`web/src/components/layout/LiveNavIndicator.tsx` (the header's dot), `web/src/components/layout/LiveAlert.tsx` (the window),
`web/src/components/community/LiveNow.tsx`, `BroadcastStage.tsx` (countdown and upcoming list) and `RecordingList.tsx`.
Cloudflare's documentation: [WebRTC (beta)](https://developers.cloudflare.com/stream/webrtc-beta/),
[live inputs](https://developers.cloudflare.com/stream/stream-live/),
[direct creator uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/) and
[resumable (tus) uploads](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/).

## 1. How it works

```
admin's browser (dashboard /live)          our API (Render)                    Cloudflare Stream
  camera + microphone (getUserMedia)
  POST /api/proxy/live/start {title, scheduleId?} -> POST /admin/live/start
                                             POST /accounts/:id/stream/live_inputs ----> new live input
                                             <---- uid, webRTC.url (WHIP, secret), webRTCPlayback.url (WHEP)
                                             saves LiveSession {title, inputUid, whepUrl}   (NOT the WHIP url)
                                             scheduled item (if any) -> "live"
  <---- 201 {session, whipUrl}  (only to this admin, only in this answer)
  WHIP: POST SDP offer to whipUrl  ---------------------------------------------> 201 SDP answer + Location
  WebRTC media (sub-second) ------------------------------------------------------>
  MediaRecorder records the same picture and sound; chunks in memory + IndexedDB    WHEP / Stream player
visitor's browser (every page of the website)
  GET /live/status every 30 s (15 s on /live) -> { live, id, title, startedAt, playbackUrl } (5 s memory cache)
  red dot on the header's Live link; "We are live now" window once per broadcast (not on /live or payment pages)
  /live: <iframe src=playbackUrl> (Cloudflare's player page; it plays WHEP by itself) <---- video

  End broadcast: WHIP DELETE (Location) + POST /admin/live/stop -> DELETE the live input; LiveSession ended;
                 the scheduled item (if any) -> "done"
  then the recording:  POST /admin/live/recordings {sessionId, sizeBytes, ...}
                                             POST /accounts/:id/stream?direct_user=true (tus) -> Location (one-time)
  <---- 201 {recordingId, uploadUrl}  (only to this admin, only in this answer)
  tus PATCH chunks to uploadUrl  (upload.videodelivery.net) ---------------------> the video, encoded by Cloudflare
  POST /admin/live/recordings/:id/uploaded   ("processing"); the dashboard's list asks Cloudflare until "ready"
  Publish (only when ready) -> GET /live/recordings lists it on /live (thumbnail first, the player on a click)
```

* **One broadcast at a time.** The database allows only one `liveSession` with status `live` (a partial unique index),
  so two people pressing Go live at the same moment get one broadcast and one "another broadcast is live" message.
* **Who can end it.** The person who started it; an owner can end anyone's after confirming (`force`). It also ends
  **by itself after 6 hours** (`LIVE_MAX_MS`): on the next status read, and by a timer in `server/index.js` every
  10 minutes. The dashboard sends a keepalive "stop" when the page is closed or reloaded, and ends the session at once
  if the camera cannot connect to Cloudflare, so the website never shows an empty player for long.
* **The public status** comes from the API's memory for 5 seconds and carries `Cache-Control: public, max-age=5`. The
  website's server peeks at it (at most every 15 seconds per server, never waiting for it) so the first render of every
  page already has the header's dot right; after that **one shared poller per browser tab** keeps it current (section
  8): every 30 seconds while the tab is visible (15 seconds on `/live`, 10 seconds for up to 30 minutes once a
  countdown reached zero), at once when the tab comes back, never while it is hidden, slower after failures and as
  slow as a `Retry-After` asks.
* **The player** is Cloudflare Stream's own player page (`https://customer-<code>.cloudflarestream.com/<input id>/iframe`,
  derived by the API from the WHEP address), in an `<iframe>` with a title. Cloudflare's player "automatically upgrades
  to WHEP" for WebRTC inputs; it has its own play, pause, volume and full-screen controls. It does not autoplay.

## 2. API

Full contract: [ADMIN.md](ADMIN.md) section 4.6. In short:

| Route | Who | Answer |
|---|---|---|
| `GET /admin/live` | editor, owner | `{ configured, maxMinutes, current, history }` (10 most recent) |
| `POST /admin/live/start { title, scheduleId? }` | editor, owner | `201 { session, whipUrl }`; `409` while one is live; `503` not configured; `502` Cloudflare refused; `scheduleId`: `404` unknown, `409` not waiting |
| `POST /admin/live/stop { sessionId?, force? }` | editor, owner | `{ stopped, session }`; `403` someone else's (editor); `409` someone else's (owner without `force`) |
| `GET /admin/live/recordings` | editor, owner | `{ configured, items, storage }` (unfinished ones are checked with Cloudflare first) |
| `POST /admin/live/recordings { sessionId, sizeBytes, durationSeconds, mimeType, title? }` | who started the broadcast, owner | `201 { recordingId, uploadUrl, recording }`; `409` it already has one |
| `POST /admin/live/recordings/:id/upload-url`, `/:id/uploaded` | who started the broadcast, owner | a new address (restart), or "the upload is done" (`processing`) |
| `PATCH /admin/live/recordings/:id { title?, published? }`, `DELETE /admin/live/recordings/:id` | editor, owner | publish only when `ready` (`409` before); delete also at Cloudflare |
| `GET`, `POST /admin/live/schedule`, `PATCH`, `DELETE /admin/live/schedule/:id` | editor, owner | scheduled broadcasts, typed in Nazareth time (section 10) |
| `GET /live/status` | anyone | `{ live: false }` or `{ live: true, id, title, startedAt, playbackUrl }` |
| `GET /live/recordings` | anyone | `{ items: [{ id, title, date, durationSeconds, thumbnailUrl, playbackUrl }] }`: published and ready |
| `GET /live/schedule` | anyone | `{ timeZone, items: [{ id, title, description, startsAt, status }] }`: published, upcoming |

Audit: `live.start` (with `scheduleId`), `live.stop` (with `reason`: `stopped` or `forced`, and the minutes),
`live.auto_end`, `live.start_failed`; `live.recording_create`, `_renew`, `_uploaded`, `_update`, `_delete`, `_status`
(the system: Cloudflare finished or failed), `_failed`; `live.schedule_create`, `_update`, `_delete`.

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
| The one-time upload address of a recording (anyone with it can upload a file as that recording until the upload is done or the address expires, 4 hours) | The same rules as the WHIP address: returned once, to the admin who asked (who started the broadcast, or an owner), never stored (not in the database and not in the browser's IndexedDB copy of the recording), never logged, never in another answer (tested). It must be on one of Cloudflare's two upload hosts (`upload.videodelivery.net`, `upload.cloudflarestream.com`); the API and the dashboard both check. Nothing is published by itself: an editor watches the preview before pressing Publish. |
| The Cloudflare API token | `CF_STREAM_API_TOKEN` on Render only (`sync: false`), sent only in the `Authorization` header to `api.cloudflare.com`; error messages carry Cloudflare's status and error codes, never the token or an address it returned. A token with **Stream: Edit** for the one account is enough (it covers live inputs, uploads, videos and the storage figure). |
| What Cloudflare answers | Checked before use: the WHIP and WHEP addresses must be `https://customer-<code>.cloudflarestream.com/.../webRTC/publish|play`, the input and video ids 32 hex, the upload address on the two upload hosts. The website frames only `https://customer-<code>.cloudflarestream.com/<32 hex>/iframe` and shows only `.../<32 hex>/thumbnails/thumbnail.jpg` (anything else is dropped). |
| Dashboard CSP | `connect-src https://*.cloudflarestream.com https://upload.videodelivery.net https://upload.cloudflarestream.com`, `frame-src` and `img-src https://*.cloudflarestream.com` **only on `/live`** (`admin/src/proxy.ts`, `admin/src/lib/csp.ts`); `media-src 'none'` stays (the camera preview uses `srcObject`, which is not a URL load). |
| Camera and microphone | `Permissions-Policy: camera=(self), microphone=(self), autoplay=(self)` **only on `/live`** (`admin/next.config.ts`); every other dashboard page keeps them off. A browser applies the policy of the page it loaded, so the menu opens `/live` with a full page load, and the page explains (with a Reload button) if it was reached another way. |
| Website CSP | `frame-src https://*.cloudflarestream.com` (the live player and the recordings' players) and `img-src https://*.cloudflarestream.com` (the recordings' thumbnails) in `web/src/lib/csp.ts`; `connect-src` and `script-src` unchanged. `Permissions-Policy` lets that origin use full screen, picture-in-picture and autoplay inside the frame. |
| Roles | Editor and owner on every dashboard route (`requireRole('editor')`), viewer 403 (tested in the role matrix). An editor cannot end someone else's broadcast (an owner must confirm) and cannot upload a recording of someone else's broadcast (an owner can). Any editor may rename, publish, unpublish and delete recordings and scheduled broadcasts. |
| Abuse of the public status | Its own rate limit (3000 per 15 minutes per address, about 50 viewers behind one address, each polling every 30 seconds on most pages) instead of the general 200; answered from memory. The recordings and the schedule are public reads (1000 per 15 minutes), answered from memory for a minute and half a minute. |
| The old room routes | `POST /live/create_room`, `GET /live/room_id`, `POST /live/close_room` (one id kept in the process memory, readable by anyone) were **removed**: no page of `web/` or `admin/` used them. The abandoned `client-next/` read `room_id`; the old admin site (separate repository) may still call `create_room` and now gets 404, which changes nothing for visitors. |
| The recording kept in the admin's browser | Until it is uploaded, the recording also sits in the browser's IndexedDB (section 9): on a shared or lost device it could be found there. It is deleted after a successful upload or on "Discard"; staff broadcast from their own devices. |
| People in the picture | Recordings show and let hear identifiable people in a religious setting: consent and notices are an owner's decision before the first recording is published ([TODO-LEGAL.md](TODO-LEGAL.md)). Every recording starts unpublished. |

## 4. Costs

* Cloudflare Stream bills WebRTC by **minutes delivered: 1 US dollar per 1,000 minutes watched** (billing for WebRTC
  delivery starts 15 October 2026, per Cloudflare's page). Example: a 45-minute prayer watched by 40 people = 1,800
  minutes = about 1.80 USD.
* **Recordings are stored videos: 5 US dollars per 1,000 minutes stored** (per month), plus 1 US dollar per 1,000
  minutes watched. The account has the **1,000-minute storage plan** (Stream shows "0/1,000 min" before the first
  recording): about 22 recordings of 45 minutes fit. The dashboard's Live page shows the minutes stored, from
  Cloudflare's own figure (`GET /stream/storage-usage`), and warns when the plan is nearly full; deleting a recording
  frees its minutes. A full plan makes Cloudflare refuse new uploads: the dashboard then says the upload could not be
  prepared, the recording stays in the browser (section 9), and the owner deletes old recordings or buys more minutes.
* Uploading a recording costs nothing at Cloudflare; it uses the admin's upload bandwidth (a 45-minute recording at
  about 2.5 Mbit/s is about 850 MB).
* The Stream subscription itself: see [Stream pricing](https://developers.cloudflare.com/stream/pricing/) (the owner
  decides the plan).
* Our API: one small database row per broadcast, recording and scheduled broadcast; the status poll is answered from
  memory.

## 5. Limits

* **WebRTC itself has no recording, no HLS/DASH, no viewer counts, no simulcast** (Cloudflare's beta). The recording is
  made by the admin's browser (section 9), so its **quality is what the browser sent**: the same 720p picture at about
  2.5 Mbit/s, re-drawn for the recorder (it survives a camera or microphone switch), with the browser's own encoder
  (MP4 on Safari, WebM on Chrome, Edge and Firefox). Network trouble between the admin and Cloudflare during the
  broadcast does not affect the recording; a recording of a broadcast that ended badly is still complete up to the end.
* **If the admin's tab dies before the upload** (the phone's battery, a crash, the tab closed), the copy in the
  browser's IndexedDB is the safety net: the next visit to the Live page on the same browser offers "Upload the
  unfinished recording". It is lost if the browser's site data is cleared, in a private window, or if the device runs
  out of storage (then the recording continues in memory only and the page says so).
* An upload that is interrupted resumes from where Cloudflare stopped while the page stays open; after a reload or a
  day later it starts again from the beginning with a new address (the address is never kept on the device).
* WebRTC is a **beta** at Cloudflare; the API shape used here was taken from their documentation on 2026-10-06
  (live inputs) and 2026-10-07 (uploads).
* One broadcast at a time; 6 hours at most; 120 characters of title; one recording per broadcast (up to 6 hours,
  30 GB).
* The admin's browser must stay on the page: leaving it ends the broadcast. On a phone the screen is kept on (Wake
  Lock) where the browser allows it; a phone call or a locked screen interrupts the camera, and the recording.
* **The dashboard's sign-out rules give way to a broadcast** (`admin/src/lib/session-hold.ts`): while a broadcast is on
  air or a recording is uploading, 30 minutes without a touch never sign the admin out (that would leave the page and end
  the broadcast; a phone on a tripod is never touched during a Mass). The 60-minute sign-in itself cannot be extended:
  if it ends during a long broadcast, the page stays on air and shows a notice: sign in again **in a new tab** (the new
  sign-in serves the broadcasting tab too), then come back and end the broadcast; the upload then works as usual. Ending
  without signing in again leaves the website showing an empty player until the broadcast ends by itself (6 hours) or
  someone ends it; the recording stays on the device and is offered for upload after the next sign-in.
* Up to about 2.5 Mbit/s of video upload (720p, 30 frames): Wi-Fi recommended.

### Recording through Cloudflare instead (not used)

Cloudflare can record a broadcast itself, but only from its other ingest: a live input created with
`recording: { mode: "automatic" }` and published with **RTMPS or SRT** from OBS or a phone app such as Larix (the
input's `rtmps.url` and `rtmps.streamKey`). Viewers then watch HLS (a few seconds of delay instead of under one), and
each broadcast becomes a stored video by itself. That needs an app on the admin's device; the browser recording of
section 9 keeps the "camera in the dashboard, nothing to install" design.

## 6. Owner set-up (once)

1. **Cloudflare account.** Sign up at https://dash.cloudflare.com (or use an existing one). Turn on two-factor sign-in.
2. **Stream.** Dashboard > Stream > subscribe (a payment method is needed; Stream is billed separately). The storage
   plan (1,000 minutes) is what recordings use.
3. **API token.** My Profile > API Tokens > Create Token > Custom token: permission **Account > Stream > Edit**, account
   resources: **only this account**, no IP filtering needed, an expiry date you will remember. Copy the token once.
4. **Account id.** Dashboard > the account's overview page, right column: "Account ID".
5. **Render.** Service `nazareth-holy-cross-api` > Environment > add `CF_ACCOUNT_ID` and `CF_STREAM_API_TOKEN` (both
   are listed in `render.yaml` with `sync: false`, so Render asks for them and never shows them in the repository) >
   Save, which redeploys. The start-up log then says `live broadcasting: configured`.
6. Never paste the token into a chat, an e-mail or the repository; if it ever leaks, delete it in Cloudflare and
   create a new one (step 3), then update Render.

Without the two variables the dashboard's Live page says "Live broadcasting is not set up yet" and nothing else changes.
Recordings and the schedule need nothing more than this.

## 7. The first broadcast (test it once, privately)

1. After the deploy, sign in to the dashboard as an editor or owner, on a **phone** (that is how most broadcasts will be
   made) on Wi-Fi.
2. Menu > **Live broadcast** > **Turn on camera and microphone**: allow both when the browser asks. The preview shows
   you (mirrored, like a mirror; viewers see you the right way round). Try **Switch camera** and the microphone list.
3. Leave **Record this broadcast** on. Title: "Test, please ignore" > **Go live**. Within a few seconds: the red
   **Live** badge with a running time and "You are live".
4. On a second device open `https://nazarethholycross.com/en`: within about 30 seconds the header's Live link gets its
   red dot and the "We are live now" window opens (once). **Watch now** goes to `/en/live`; press play. Check sound,
   delay (should be under a second) and full screen.
5. After two or three minutes: **End broadcast** > confirm. The website removes the player and the dot within about
   30 seconds. The dashboard uploads the recording (a progress bar), then shows it as "Processing" and, a minute or so
   later, "Ready". Watch it in the preview, then **Publish**: `https://nazarethholycross.com/en/live` lists it under
   past broadcasts within a minute. Unpublish or delete it afterwards.
6. In Cloudflare > Stream > Live inputs, the input of the test is gone (deleted by the API); in Stream > Videos the
   recording is there while it exists in the dashboard, and gone after **Delete**. The owner's Audit log shows
   `live.start`, `live.stop` and the `live.recording_*` steps.
7. Schedule a broadcast for tomorrow, publish it, and look at `/en/live`: the countdown shows it, with the time in
   your zone and in Nazareth time, and "Add to calendar" downloads an `.ics` file. Delete it again.

If the phone says the camera was refused: browser settings for the dashboard's site > Camera and Microphone > Allow,
then reload. On iPhone: Settings > Safari > Camera / Microphone > Ask or Allow.

## 8. On the website: the dot, the window, the countdown, the past broadcasts

* **One poller per tab.** `GET /live/status` is asked by one shared poller in each browser tab, whatever reads it: the
  header's dot, the "We are live now" window and the `/live` player. It polls at the shortest interval any of them asks
  for (30 seconds on any page, 15 on `/live`, 10 for up to 30 minutes after a countdown reached zero), never while the
  tab is hidden, at once when it becomes visible (not more than once in 5 seconds), and backs off after errors (up to 2
  minutes, or what a `Retry-After` says). The first browser question waits until the server's own peek (which seeds the
  first render) is one interval old, so a quick visit costs the API nothing.
* **The red dot** on the header's Live link (desktop menu and phone drawer, every page) shows while a broadcast is live
  and goes away when it ends, without a reload. It pulses gently; it is still when the visitor asked for less motion
  (system setting or the accessibility panel's "Stop animations"). Screen readers hear "(live now)" after "Live".
* **The "We are live now" window** (a native modal `<dialog>`: the heading, the broadcast's title, **Watch now** and
  **Not now**; Escape and a click outside close it; the focus starts on Watch now and goes back where it was) opens on
  any page except `/live` and the payment pages (`/cart`, `/checkout`, `/candle`, `/donate` and their sub-pages: a
  payment is never interrupted), only after 4 seconds on a page, only on a status read less than a minute old, not while
  another dialog or the menu is open or the visitor is typing in a field, and **once per broadcast** per browser (the
  broadcast's id is remembered in `localStorage` under `nhc.liveAlert.v1`, the last 20; without storage, once while the
  tab lives). It is the one pop-up of the site, asked for by the owner
  (docs/DESIGN-GUIDE.md section 1.5).
* **The countdown.** When nothing is live, `/live` shows the next published scheduled broadcast (section 10) in a glass
  card: days, hours, minutes and seconds (minutes only for visitors who asked for less motion), the title, the date and
  time in the visitor's own time zone **and** in Nazareth time, the description, and **Add to calendar** (an `.ics`
  file made in the browser). Screen readers get a summary updated at most once a minute, not every second, and hear
  only changes such as "Starting now". At zero it says "Starting soon" and the status poller asks every 10 seconds for
  up to 30 minutes, so the player appears as soon as the admin goes live. The other upcoming broadcasts are listed
  below it. A scheduled broadcast drops off two hours after its time if it never started.
* **Past broadcasts** lists the published recordings first (newest first: title, date of the live in the page's
  language and Nazareth time, length), then the older videos kept in the site. A recording shows its thumbnail; the
  Cloudflare player is loaded only when the visitor presses play (never all frames at once).
* **Structured data**: a `VideoObject` per published recording (`uploadDate` = the date of the live), in the page's
  own block; an `Event` (online) per published upcoming broadcast, written once, by the Christian calendar section
  (`web/src/lib/broadcastSchedule.ts`, `broadcastEventsJsonLd`). The countdown and the calendar read the same
  `GET /live/schedule` answer (the server reads it once per minute through Next's data cache).

## 9. Recordings

**In the dashboard, while broadcasting.** The **Record this broadcast** switch (on by default) is set before going live.
A `MediaRecorder` records what is being broadcast: the camera picture re-drawn on a canvas and the microphone through
the browser's audio mixer, so switching camera or microphone during the broadcast does not interrupt the recording;
mute records silence. The format is the first the browser supports of MP4 (Safari) and WebM VP9 or VP8 with Opus
(Chrome, Edge, Firefox), at about 2.5 Mbit/s. Every few seconds a piece of the recording is kept in memory **and**
written to the browser's IndexedDB.

**After End broadcast** the browser puts the pieces together and uploads the file **straight to Cloudflare**:

1. `POST /admin/live/recordings { sessionId, sizeBytes, durationSeconds, mimeType }`: the API checks the broadcast is
   the caller's (or the caller is an owner) and has no recording yet, asks Cloudflare for a one-time **tus** upload
   address (`POST /accounts/<id>/stream?direct_user=true` with `Tus-Resumable: 1.0.0`, `Upload-Length` and
   `Upload-Metadata`: the name, a maximum length (the measured one plus 20% and 5 minutes, at most 6 hours) and an
   expiry four hours ahead), saves the recording as `uploading` and answers with the address, once.
   The tus protocol is used for every size (Cloudflare requires it above 200 MB, and it lets an upload resume).
2. The browser sends the file in pieces of a few megabytes (`PATCH` with `Upload-Offset`, multiples of 256 KiB as
   Cloudflare requires), shows the progress, and after a network failure asks Cloudflare where it stopped (`HEAD`) and
   continues from there. An expired address (after four hours, or a recording found the next day) is replaced by a new
   one (`POST /admin/live/recordings/<id>/upload-url`), and the upload starts again from the beginning.
3. `POST /admin/live/recordings/<id>/uploaded`: `processing`. Cloudflare encodes the video (a minute or a few); the
   dashboard's list asks Cloudflare (`GET /stream/<uid>`) until it is `ready` (or `failed`), and then takes Cloudflare's
   own duration. The browser deletes its IndexedDB copy.
4. **Publish** (only when ready): the recording appears on `/live` within a minute. Unpublish, rename and delete
   (which deletes the video at Cloudflare too) at any time.

**Unfinished recordings.** If the page or the browser died before the upload finished, the next visit to the Live
page on the same browser finds the IndexedDB copy and offers **Upload the unfinished recording** (or **Discard**). If the
broadcast already has a recording row (the upload had started), a new upload address replaces the old one.

## 10. Scheduled broadcasts

The Live page of the dashboard has **Schedule a broadcast**: a title, the date and time **in Nazareth time** (the API
converts it to UTC: the hour that does not exist in spring moves forward by an hour, the hour that happens twice in
autumn is the first one), an optional description (up to 500 characters) and a **Publish** switch (a draft until it is
on). The list shows what is coming (and the last week), with edit, publish or unpublish, cancel or restore, and delete.

When the admin presses Go live, a list offers the scheduled broadcasts that are waiting; the one starting within two
hours of now is chosen already, and choosing one fills in its title. That broadcast then shows as **live**, and as
**done** when the broadcast ends (also when it ends by itself after six hours). The website shows published ones that
are still to come (or started less than two hours ago), the next one with the countdown of section 8.

## 11. Tests and what is not verified

* `server/__tests__/live.test.js`: the Cloudflare client against a fake `fetch` (request shape, token only in the
  header, error handling, address checks), the routes against a fake Cloudflare client
  (`server/test-harness/fake-cloudflare.js`): start, the single-session rule and the race, stop (own, someone else's,
  owner with force, repeated, a late stop after a newer start), Cloudflare failures, the automatic end, roles, the
  public status and its cache and rate limit, the WHIP address appearing nowhere else, and the removed room routes.
* `server/__tests__/live-recordings.test.js`: the tus upload request (headers, metadata, caps), the upload-host
  allow-list, reading and deleting a video and the storage figure; the routes: the upload address appearing nowhere
  else, who may upload, one recording per broadcast and the race, processing to ready or failed, never backwards, at
  most every 10 seconds, publish only when ready, the public list (published and ready only, from memory, following
  every change), delete at Cloudflare, a new address, the storage figure, roles, every query through `sanitizeFilter`
  and the real schema.
* `server/__tests__/live-schedule.test.js`: Nazareth time to UTC on both clock changes of 2026 and 2027 (checked against
  `Intl` for every hour of those days and every evening of a year), the routes with their checks and audit, the public
  upcoming list (published, the two-hour grace, at most ten, from memory), going live from a scheduled broadcast to live
  and done (also by the automatic end). The role matrix (`admin-roles.test.js`) includes every new dashboard route.
* The dashboard: unit tests of the recorder, the IndexedDB store, the tus upload, the CSP of `/live`, the proxy
  allow-list and the schedule helpers; `admin/tests/unit/parity.test.ts` runs the live, recording and schedule steps
  against the mock and the real API; `admin/tests/e2e/live.spec.ts` and the recording and schedule specs on the mock and
  the harness: a fake camera, a stubbed `MediaRecorder` and the tus upload answered inside the browser, from going live
  with recording to publishing, the unfinished-recording offer, scheduling and going live from a scheduled broadcast,
  axe on desktop and phone, Hebrew.
* The website: unit tests of the shared poller, the window's rules, the countdown (also across the clock changes) and
  its formats, the `.ics` file, the parsing of recordings and the schedule, the structured data; end-to-end tests with
  every API answer and Cloudflare's player intercepted in the browser: the dot appearing and going without a reload,
  the window once per broadcast and never on `/live` or the payment pages (keyboard, Escape, focus), the countdown and
  "Starting soon" with a mocked clock, the calendar file, past broadcasts with a recording, right to left, axe.

**Verified with a real Cloudflare account (2026-10-07, by the owner):** the WebRTC broadcast end to end (WHIP from the
dashboard, the player on `/live`).

**Not verified (needs a real broadcast):** a real `MediaRecorder` on an iPhone (Safari's MP4) and on Android (Chrome's
WebM), the canvas re-drawing on a slow phone (battery, heat, frames per second), a real tus upload to Cloudflare (the
upload host in `Location`, CORS of `PATCH` and `HEAD`, the `Upload-Offset` header after a cut connection, the expiry in
`Upload-Metadata`), Cloudflare's processing times and its `storage-usage` figure, the thumbnail and the stored-video
player inside our pages, IndexedDB limits on an iPhone (Safari may evict site data after seven days without a visit),
and the `.ics` file in every calendar app. Section 7 checks most of these in fifteen minutes.
