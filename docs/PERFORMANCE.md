# Performance and media quality

Measured on 2026-10-05 on the local production build (`next build` + `next start`), Microsoft Edge, against the live API.
What was measured, what was changed, what is left, and how to measure again.

**Home hero update (2026-10-07):** the home page now shows only its existing licensed `city-sunset-glow`
photo at every width. The film measurements and implementation notes below describe the previous version, not
the current home page. The encoded tour and loop files remain stored but are not requested by the home hero.
`web/tests/e2e/hero-film.spec.ts` checks that no video is mounted or fetched on desktop or phone.

## 1. How to measure

| Tool | What it gives | Command (from `web/`) |
|---|---|---|
| Lighthouse 12 (through `npx`, not a dependency) | score, FCP, LCP, CLS, TBT, bytes. Mobile = Lighthouse's slow-4G **simulation**; desktop = no throttling | `QA_BASE=http://localhost:3801 QA_LABEL=run CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node tests/qa/lighthouse.mjs` |
| Lab probe (Playwright + CDP) | LCP element, CLS, blocking time, **real** throttling (phone: CPU x4, 1.6 Mbit/s, 150 ms), bytes by type incl. the hero film, a screenshot per page | `PW_CHANNEL=msedge QA_BASE=http://localhost:3801 QA_LABEL=run QA_SHOTS=<folder> node tests/qa/measure-perf.mjs` |
| Smoke test with budgets | fails the build on a regression (see section 7) | `E2E_PORT=3802 PW_CHANNEL=msedge npx playwright test tests/e2e/performance.spec.ts` |
| Image audit | every older photo: pixels, weight, "soft as a wide picture" flag | `node scripts/media/audit.mjs` |

Run `next build` only while the API's `RateLimit` header (`curl -sI https://nazareth-holy-cross-api-production.up.railway.app/health`)
shows plenty of requests left (200 per 15 minutes per address, shared by everything on the machine); a build or test
that is throttled shows error states.

Pages measured: `/en`, `/en/sites/latin`, `/en/shop`, `/en/candle`, `/en/gallery`.
Lighthouse sizes are transfer sizes. Lighthouse does not see the hero film (it starts after the load event), so the
film is listed separately from the lab probe.

## 2. BEFORE (branch `web/integrated`, commit fb5c802)

### Lighthouse 12 (performance category)

| Page | Form | Score | FCP | LCP | CLS | TBT | Total | Images | JS |
|---|---|---|---|---|---|---|---|---|---|
| /en | mobile | 76 | 1.8 s | 6.7 s | 0.000 | 20 ms | 947 kB | 229 kB | 197 kB |
| /en/sites/latin | mobile | 76 | 1.4 s | 7.7 s | 0.000 | 20 ms | 1255 kB | 517 kB | 207 kB |
| /en/shop | mobile | 76 | 1.5 s | 6.9 s | 0.000 | 99 ms | 1054 kB | 199 kB | 311 kB |
| /en/candle | mobile | 78 | 1.4 s | 6.2 s | 0.000 | 24 ms | 868 kB | 51 kB | 303 kB |
| /en/gallery | mobile | 75 | 1.5 s | 10.0 s | 0.000 | 27 ms | 1935 kB | 1181 kB | 209 kB |
| /en | desktop | 98 | 0.3 s | 1.2 s | 0.000 | 0 ms | 967 kB | 247 kB | 197 kB |
| /en/sites/latin | desktop | 95 | 0.4 s | 1.5 s | 0.000 | 0 ms | 1381 kB | 641 kB | 207 kB |
| /en/shop | desktop | 97 | 0.4 s | 1.3 s | 0.000 | 0 ms | 1062 kB | 199 kB | 311 kB |
| /en/candle | desktop | 97 | 0.3 s | 1.2 s | 0.000 | 0 ms | 868 kB | 51 kB | 303 kB |
| /en/gallery | desktop | 93 | 0.4 s | 1.8 s | 0.000 | 0 ms | 1939 kB | 1184 kB | 209 kB |

### Lab probe with real throttling (phone: CPU x4, 1.6 Mbit/s, 150 ms; desktop: none), cold cache, first 4 s

| Page | Form | LCP | CLS | TBT~ | Total | Images | JS | Film | Fonts |
|---|---|---|---|---|---|---|---|---|---|
| /en | mobile | 2.89 s | 0.000 | 318 ms | **13 886 kB** | 294 kB | 180 kB | **12 996 kB** | 366 kB |
| /en/sites/latin | mobile | 4.36 s | 0.040 | 291 ms | 776 kB | 174 kB | 188 kB | 0 | 366 kB |
| /en/shop | mobile | 2.30 s | 0.000 | 340 ms | 993 kB | 297 kB | 288 kB | 0 | 366 kB |
| /en/candle | mobile | 2.29 s | 0.000 | 298 ms | 774 kB | 76 kB | 282 kB | 0 | 366 kB |
| /en/gallery | mobile | 7.07 s | 0.000 | 283 ms | 1267 kB | 656 kB | 190 kB | 0 | 366 kB |
| /en | desktop | 0.18 s | 0.000 | 17 ms | 8019 kB | 286 kB | 180 kB | 7140 kB (of 21 MB, 4 s) | 366 kB |
| /en/sites/latin | desktop | 0.17 s | 0.000 | 9 ms | 779 kB | 177 kB | 188 kB | 0 | 366 kB |
| /en/shop | desktop | 0.20 s | 0.000 | 0 ms | 845 kB | 145 kB | 288 kB | 0 | 366 kB |
| /en/candle | desktop | 0.20 s | 0.000 | 4 ms | 744 kB | 48 kB | 282 kB | 0 | 366 kB |
| /en/gallery | desktop | 0.20 s | 0.000 | 7 ms | 1303 kB | 698 kB | 190 kB | 0 | 366 kB |


## 3. AFTER

### Lighthouse 12 (performance category)

| Page | Form | Score | FCP | LCP | CLS | TBT | Total | Images | JS |
|---|---|---|---|---|---|---|---|---|---|
| /en | mobile | **86** (was 76) | 1.2 s | **4.2 s** (6.7) | 0.000 | 10 ms | 693 kB | 239 kB | 216 kB |
| /en/sites/latin | mobile | **80** (76) | 1.4 s | **5.5 s** (7.7) | 0.000 | 18 ms | 912 kB | 452 kB | 215 kB |
| /en/shop | mobile | **80** (76) | 1.5 s | **5.2 s** (6.9) | 0.000 | 65 ms | 844 kB | 268 kB | 320 kB |
| /en/candle | mobile | **87** (78) | 1.1 s | **4.1 s** (6.2) | 0.000 | 15 ms | 550 kB | 109 kB | 218 kB |
| /en/gallery | mobile | 76 (75) | 1.4 s | 7.8 s (10.0) | 0.000 | 47 ms | 1563 kB | 1091 kB | 217 kB |
| /en | desktop | **99** (98) | 0.3 s | 0.9 s (1.2) | 0.000 | 0 ms | 806 kB | 351 kB | 216 kB |
| /en/sites/latin | desktop | 96 (95) | 0.4 s | 1.4 s (1.5) | 0.000 | 0 ms | 1131 kB | 671 kB | 215 kB |
| /en/shop | desktop | 97 (97) | 0.4 s | 1.2 s (1.3) | 0.000 | 0 ms | 932 kB | 348 kB | 320 kB |
| /en/candle | desktop | **99** (97) | 0.3 s | 1.0 s (1.2) | 0.000 | 0 ms | 635 kB | 193 kB | 218 kB |
| /en/gallery | desktop | 95 (93) | 0.3 s | 1.5 s (1.8) | 0.000 | 0 ms | 1659 kB | 1184 kB | 217 kB |

Images are heavier on the desktop shop and holy-site pages than before on purpose: the heroes are now sharp 1920 px
photos instead of 612-1024 px files stretched over the screen. JavaScript is 19-20 kB higher in Lighthouse's count
(197 to 216 kB on the home page); the cause was not isolated (the dynamic-import runtime and the new lazy wrappers are the
likely part). It is the one number that went the wrong way.

### Lab probe with real throttling (same conditions as before)

| Page | Form | LCP | CLS | TBT~ | Total | Images | JS | Film | Fonts |
|---|---|---|---|---|---|---|---|---|---|
| /en | mobile | 2.89 s | 0.000 | 48 ms | **588 kB** (13 886) | 257 kB | 196 kB | **0** (12 996) | **90 kB** (366) |
| /en/sites/latin | mobile | **2.66 s** (4.36) | 0.000 (0.040) | 61 ms | 438 kB | 109 kB | 195 kB | 0 | 90 kB |
| /en/shop | mobile | 2.30 s | 0.000 | 285 ms | 717 kB | 290 kB | 295 kB | 0 | 90 kB |
| /en/candle | mobile | 2.14 s | 0.000 | 264 ms | 460 kB | 128 kB | 197 kB | 0 | 90 kB |
| /en/gallery | mobile | **4.29 s** (7.07) | 0.000 | 72 ms | 906 kB | 566 kB | 197 kB | 0 | 90 kB |
| /en | desktop | 0.16 s | 0.000 | 0 ms | 2215 kB (8019) | 430 kB | 196 kB | 1456 kB (the whole 16 s loop; was 7140 kB in 4 s of a 21 MB file) | 90 kB |
| /en/sites/latin | desktop | 0.13 s | 0.000 | 0 ms | 508 kB | 177 kB | 195 kB | 0 | 90 kB |
| /en/shop | desktop | 0.13 s | 0.000 | 0 ms | 725 kB | 294 kB | 295 kB | 0 | 90 kB |
| /en/candle | desktop | 0.20 s | 0.000 | 7 ms | 516 kB | 189 kB | 197 kB | 0 | 90 kB |
| /en/gallery | desktop | 0.20 s | 0.000 | 0 ms | 1031 kB | 698 kB | 197 kB | 0 | 90 kB |

How to read the two tables: Lighthouse's mobile run is a simulation (a model of a slow phone), the probe throttles
the real network and CPU of the browser; they agree on direction. The home page's LCP in the probe did not move
(2.9 s) although the photo is now a sharp 1920 px file instead of a soft 828 px one (more detail for the same time);
what moved there is the film (13 MB to 0 on a phone) and the fonts (366 kB to 90 kB). The mobile LCP in Lighthouse is
still above 2.5 s: 4.1-5.5 s on a simulated slow 4G. What is left in it is the framework's JavaScript (216 kB) and the
sharp hero photo; to go lower the photo would have to be smaller or softer.

Screenshots (before and after, mobile and desktop, five pages): `scratchpad/performance/{before,after}-{mobile,desktop}-*.png`
(not in the repository).


## 4. What changed

### Images

* **Audit** (`node scripts/media/audit.mjs`): 85 older files (26 MB) in `public/images`, 34 flagged as small or soft when
  shown across the screen; the 40 licensed photos in `public/images/nazareth-media` are 3-4 widths of AVIF + WebP each
  (the largest AVIF is 17-490 kB). Every `next/image` already has a `sizes` attribute; every licensed photo goes through
  `MediaPicture` (AVIF, WebP fallback, blur placeholder, focal point).
* **Soft heroes replaced** with licensed 2560 px photos (placements follow `docs/MEDIA.md`, section 7): home hero
  (`nazareth1.webp` 1024x683 -> `city-sunset-glow`), shop and legal/FAQ/search/reviews/candle/prayers/live/plan/visit/tour
  heroes (`vitrage-bg.jpg` 612x408, `candle.jpg` 640x428, `latin8.jpg`, ... ), the home sites carousel (now the place
  covers, `placeCards()`), and the social cards of cart, checkout, candle and donate. `PageHero` takes
  `media={getMedia(id)}`; the old `image="/images/..."` path still works for anything not yet replaced.
* **Lean copies** (`scripts/media/lean.mjs`, `<MediaPicture lean />`): the home hero sits under a dark gradient, so its
  AVIF is compressed harder (quality 38): 118 kB instead of 252 kB at 1920 px, 195 kB instead of 402 kB at 2560 px, with
  no visible difference under the scrim. A phone gets the 1920 px file (`sizes="(max-width: 767px) 700px, 100vw"`).
* **LCP image preload**: `MediaPicture priority` now calls React's `preload()` with the same `srcset` and `sizes` as
  the `<img>` (AVIF), and sets `fetchpriority=high`; the page heroes (`PlaceHero`, `PageHero`) use it.
* **`PlaceHero` `sizes`**: `(max-width: 767px) 740px, 100vw` instead of `max(100vw, 1200px)`. A phone takes the 1920 px
  file instead of the 2560 px one (about a third lighter) and the photo is still sharp.
* **next/image config** (`next.config.ts`): AVIF then WebP, `minimumCacheTTL` 31 days (default 4 hours),
  `deviceSizes` 640/828/1080/1280/1920/2560 (no 750, 2048, 3840), `imageSizes` 64-512, `qualities` 75 and 85.
* **Still soft (not changed, no better source)**: the older gallery photos in `public/images/{latin,greek,mary,old,nazareth}`
  (their origin and licence are not recorded, see MEDIA.md section 8) and the two video posters. Replace them with
  licensed or the owner's own photos when available.

### Video

| File | As uploaded | Now | Where |
|---|---|---|---|
| Home hero loop (`video-7.mp4`) | 640x360, 4 min 2 s, with sound nobody hears, **21.0 MB**, autoplays on every desktop visit | first 16 s, silent, 1280x720 (Lanczos upscale + light sharpen), **1.4 MB AV1/WebM + 2.0 MB H.264/MP4** | `public/videos/hero-loop.*` (since 2026-10-07 the fallback of the tour film below) |
| Home hero film (2026-10-07): the whole virtual tour (`tour-720p.mp4`, 8 min 53 s, 97 MB) | | silent, 1.5x faster (5 min 49 s), cropped to 1024x576 to leave out the burned-in subtitles and the logo, the nine place-name cards painted out, the end card cut, 960x540, 25 fps, a keyframe every 2 s, light denoise, H.264 High two-pass at 460 kbit/s, then cut without re-encoding into **12 parts of 30 s, 1.0 to 2.8 MB each, 20.1 MB in all** (20 095 592 bytes), each with `+faststart` | `public/videos/hero-tour-00.mp4` ... `hero-tour-11.mp4` |
| Live prayer 17 Sep 2024 | 520x850, 118 s, **13.4 MB** | **4.9 MB AV1/WebM + 6.1 MB H.264/MP4** | `public/videos/live-17-9-24.*` |
| Interview | 516x848, 6 min 21 s, **69.3 MB** | 33 MB WebM / **38.7 MB** MP4 (too big for the repository) | **upload to Firebase** (below) |
| Virtual tour (`tour.mp4`) | 1920x1080, 8 min 53 s, 12.4 Mbit/s, **811.8 MB** | **209 MB** 1080p H.264 (3.1 Mbit/s) and **93 MB** 720p | **upload to Firebase** (below) |

The source of the hero film is only 640x360, so it cannot be made sharper than it is; the 720p re-encode is a
slightly crisper upscale than the browser's own, and the licensed 2560 px poster underneath is sharp. **To really fix
it the owner needs the original 1080p footage of the aerial film.**

* `HeroVideo` (`components/home`), since 2026-10-07 the whole tour instead of the 16 s loop (the owner's choice: a
  self-hosted file, so no video service bills the minutes a background plays; an HLS stream on Cloudflare Stream was
  designed and dropped for that reason, so there is no `hls.js` and no new CSP host):
  * mounted only on a screen 768 px or wider, with a good connection (`navigator.connection.effectiveType` is "4g"
    where the browser reports it; Safari and Firefox do not, and are treated as a good desktop connection), never with
    `Save-Data`, `prefers-reduced-motion` or the panel's "Stop animations";
  * mounted only after the `load` event and when the browser is idle (`requestIdleCallback`), so it never competes with
    the photo, which stays the LCP element; nothing of the film is in the server HTML;
  * `preload="none"`, `muted`, `playsInline`: no byte of it is fetched until it is asked to play, and it plays only
    while the hero is on screen and the tab is visible (IntersectionObserver, `visibilitychange`) and the visitor has
    not paused it (`<MotionToggle>`, WCAG 2.2.2); it fades in over the photo once it really plays;
  * **in parts, on purpose.** The first version was one 20 MB file: Microsoft Edge then downloaded **3.1 MB in the
    first 3 seconds and 6.0 MB after 30 seconds** (it buffers about a minute ahead on a fast line), and the budget test
    did not see it (a streaming request is not in the resource timing until it ends). Now two stacked `<video>`
    elements take turns: one plays a 30-second part, the other loads the next part 8 seconds before the end and takes
    over when it ends (no gap: the parts are cut on keyframes); after the last part the tour starts again. Measured the
    same way (CDP, local production build, Edge 1440 px): **1.4 MB in the first 3 seconds** (the first part) and 3.0 MB
    after 30 seconds (the first two parts);
  * the H.264 file is the only copy: an AV1 copy was measured (10.7 MB at 300 kbit/s, but visibly softer: VMAF 64.8
    against 74.2 on a busy minute; at the same look about 14 MB) and left out to keep the repository small;
  * if a part cannot be loaded or decoded (an `error` event) the 16 s loop takes the tour's place (AV1/WebM, else MP4);
    if that fails too, the photo stays. A browser without H.264 (Playwright's own Chromium) gets the loop directly.
    `npm run test:e2e` checks all of it (`tests/e2e/hero-film.spec.ts`, including the order of the twelve parts);
  * there is no separate poster image: the licensed photo underneath is the poster (and the LCP element), the film fades
    in over it only once it plays;
  * the tour's own place-name cards (white boxes at the lower left, a few seconds each at nine places) are painted out
    while they are on screen (ffmpeg `delogo`, listed in `TOUR_LABELS` of the encode script): the crop that removes the
    subtitles would otherwise cut them in half ("'s Well"). Found by a scan for white boxes with dark text, checked
    frame by frame, and the result scanned again (no card left; the remaining hits were a bright doorway and a
    stained-glass window).
* **Bandwidth of the hero film.** It streams at about 460 kbit/s: **about 3.4 MB per minute** a desktop visitor keeps
  the hero on screen (1.4 MB for the first 30 seconds), at most 20.1 MB for the whole tour, and nothing for phones,
  slow connections, data savers or visitors who asked for less motion. The parts are cached for a month (`/videos/*`),
  so a second visit or a second round of the tour is served from the browser's cache. On Netlify that is ordinary site bandwidth (no per-minute charge); if the bandwidth
  ever matters, the knobs are, in this order: the width threshold (`WIDE_QUERY` in `HeroVideo.tsx`), the bit rate
  (`scripts/video/encode.mjs`, job `heroTour`), or the 2 MB loop instead of the tour (`filmPlan` in `HeroVideo.tsx`).
* To encode it again, from `web/`: `node scripts/video/encode.mjs C:/Users/saher/nhc/video-out public/videos heroTour`
  (needs ffmpeg with libx264; it reads `tour-720p.mp4`, the output of the `tour` job, and writes only the twelve parts;
  a second run gave the same sizes within 3 kB). Give a new encode new file names: the files are cached for a month.
* The tour and the two recordings keep `preload="none"` (nothing downloads until play), a licensed poster (tour) and
  `<source>` lists (`lib/videos.ts`). `/videos/*` is served with `Cache-Control: public, max-age=2592000`.
* **Captions: none added.** The tour has burned-in English subtitles and spoken English narration; the recordings have
  speech. A transcript would need speech recognition and review by someone who understands the words; a wrong caption is
  worse than none. WCAG 1.2.2 stays an open content task (QA.md).
* **Upload instructions** (the owner's Firebase project, `nazareth-holy-cross.appspot.com`, folder `videos/`; nothing
  was uploaded by this work):
  1. The re-encoded files are in `C:\Users\saher\nhc\video-out\` (`tour-1080p.mp4`, `tour-720p.mp4`, `interview.mp4`);
     `node scripts/video/fetch-sources.mjs <folder>` + `node scripts/video/encode.mjs <folder> <out>` make them again
     (needs ffmpeg with libx264 and libsvtav1).
  2. Firebase console > Storage > `videos/` > upload as **new names** (`tour-1080p.mp4`, `tour-720p.mp4`,
     `interview-web.mp4`) so the old addresses keep working until the change is live. Open each file's details and
     copy its download URL (with the `token=`).
  3. In `web/src/lib/videos.ts` put the 1080p URL in `TOUR_VIDEO` (and, for a phone, add the 720p one as a second
     `<source media="(max-width: 767px)">`, which needs a `media` field on `VideoSource`), and the interview URL in
     `INTERVIEW_VIDEO`. Check the video plays on `/tour` and `/live` (past recordings), then delete the 811 MB original.
  4. For a long-term fix use adaptive streaming (HLS) from a video host or CDN instead of one MP4; the page would then
     use `hls.js`, a new dependency, so it needs its own review.

### JavaScript, CSS, fonts

* **Fonts**: the page used to download **375 kB** of fonts on every visit: eight preloaded files (Latin, Latin-extended,
  Cyrillic and Greek of two families) plus 91 kB downloaded twice (my first attempt, a second instance of each family,
  made it worse; one instance per family is right: `subsets: ['latin']` decides only what is *preloaded*, the other
  scripts are still declared by unicode-range). Now only the two Latin files are preloaded (**90 kB**). The footer
  and menu named the 14 languages in their own scripts, which made every page fetch the Cyrillic, Greek and
  Latin-extended files (122 kB): those names are set in the system font (`var(--symbols)`) instead.
* **Layout shift** (QA: 0.09 on the home hero in en/de on a slow phone): the web font is now preloaded, small and
  arrives before the first paint; next/font adds a size-adjusted fallback face (`EB Garamond Fallback` over Times New
  Roman, `size-adjust: 94.77%`, ascent/descent overrides). Measured CLS is 0.000 on all five pages, mobile and desktop.
* **Lazy parts**: the PayPal buttons and their React wrapper (`LazyPayPalPanel`, loaded when the payment step opens;
  the SDK itself is fetched from paypal.com only then, as before), the photo viewer (`Lightbox`, on the first click),
  and the search palette (`LazySiteSearch`: a few lines wait for Ctrl/Cmd+K or the footer button, then fetch the
  palette, which opens at once). The carousel stays server-rendered (it is in the first screen's flow; deferring it
  would shift the layout).
* **What is left in the first load** (home, mobile: 216 kB of JavaScript, compressed): React, Next's client, next-intl
  and the layout (header, footer, cart provider, toast). Lighthouse still lists about 27 kB of unused JavaScript and 13 kB
  of "legacy" syntax (framework code); it is not worth a custom build.
* **Cache headers** (`next.config.ts`): `/images/nazareth-media/*` and `/videos/*` one month + a week
  stale-while-revalidate; other `/images` and `/sounds` one day + a week; `/_next/static` is immutable (Next's default);
  `/_next/image` 31 days (`minimumCacheTTL`).

### Rendering and caching: what the CSP nonce costs

Every page is dynamic (`ƒ` in the build output) because `src/proxy.ts` gives each response its own
Content-Security-Policy nonce, and only a request-time render can put it on the scripts and styles
(`docs/SECURITY.md`). The honest cost:

* The HTML cannot be cached by a CDN or a browser (`Cache-Control: private, no-cache, no-store`), and every view runs a
  server render. Locally the time to first byte is 14-33 ms (pages are small, translations are in memory, API reads
  come from Next's data cache); on Netlify expect that plus a function wake-up (a few hundred ms after idle) and, on a
  miss of the data cache, the API's round trip. `export const revalidate = ...` on the pages is inert for this reason.
* Mitigations done: all API reads are cached by Next's data cache for 10 minutes (catalogue, best sellers; similar
  products 30 minutes) and shared when concurrent (section 6); static assets are immutable or cached for a month; the
  shop streams a skeleton (`loading.tsx`) while its data loads; `Set-Cookie: NEXT_LOCALE` is no longer sent to clients
  that have no language to remember (probes, curl). `next-intl` already sets that cookie only when the browser's
  language differs from the page's (`src/proxy.ts`, `tests/unit/proxy.test.ts`); `localeCookie: false` would break
  "remember the language I chose", so it was not used.
* **Not done, needs a security decision**: to get static, CDN-cached HTML back, replace the nonce with hashes (Next's
  experimental `sri` option, `docs` > guides > content-security-policy > "Subresource Integrity"). The PayPal SDK adds
  scripts and styles of its own, which is what `'strict-dynamic'` + the nonce allow today; a hash policy would need
  those hosts allowed explicitly and its own review and E2E pass. Until then keep TTFB low (above) and do not add
  `Cache-Control` to the HTML.

## 5. API reads that survive a rate limit (web)

The API allows 200 requests per 15 minutes per address. On Netlify the site's server shares its outbound address with
other sites, so a build or a burst of refreshes can see `429` or a sleeping host (`502-504`). What the code does now
(`src/lib/api.ts`, `src/lib/shop/load.ts`, `tests/unit/api-resilience.test.ts`):

* **Retry with backoff**: 2 retries (0.4 s, 0.8 s + jitter, at most 3 s, honouring `Retry-After`) while a visitor waits;
  5 retries with waits up to 20 s while `next build` runs, where nobody is waiting. A Cloudflare challenge
  (`cf-mitigated`) is never retried.
* **Stale-if-error**: the last good answer for each address is kept in memory (300 addresses) and served when a refresh
  ends in an error, with a warning in the log. A 404 is an answer and is never replaced. An address never read before
  can still fail, and then the page shows its own error state ("try again"), as before.
* **One request per address at a time**: identical reads that are in flight together share one request.
* **Long revalidate for rarely-changing data**: catalogue and best sellers 10 minutes (was 2), similar products 30 minutes
  (was 5); reviews and prayers keep 1-2 minutes. Next's data cache serves them stale while it refreshes.
* **Nothing is baked at build time**: every page is dynamic (section 4), so `next build` makes no API read at all
  (the API's `RateLimit` stayed at 197 of 200 across a build). If a page ever becomes static again, the product pages
  take the catalogue once (`generateStaticParams` and the page share the same cached read), a failed read during the
  build renders the page's error state only for pages that are rebuilt on the next visit, and ISR keeps the last good page
  when a refresh throws (see the comment on `failed()` in `load.ts`).

## 6. API: higher read limit and cache headers (server)

Proposal, and implemented in `server/utils/security.js` + `server/app.js`, tests in `server/__tests__/read-limits.test.js`:

* **A separate `readLimiter`** (1000 requests per 15 minutes per IP) for the public, read-only GET routes:
  `/product/getAllProducts`, `getNProducts`, `getProduct/:id`, `catalog`, `bestSellers`, `:id/similar`, `:id/reviews`,
  `/review/getReviews`, `/prayer/getPrayers`. Its counter is separate from the strict 200 that every other request keeps,
  so reads do not eat the allowance of the payment and form routes and the reverse.
* **`Cache-Control` on those answers** so a CDN or the browser absorbs repeat traffic:
  catalogue-like data `public, max-age=60, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400`; reviews and
  prayers `public, max-age=30, s-maxage=60, stale-while-revalidate=300, stale-if-error=3600`. Errors (4xx, 5xx, 429) are
  always `no-store`, so a product added a minute ago is not hidden by a cached 404.
* `Vary: Origin` is already sent by the CORS middleware, so a shared cache does not hand one origin's answer to another.
* **Not in this branch**: `/product/catalog`, `bestSellers`, `:id/similar` and `:id/reviews` exist on `feat/shop-catalog-data`
  (merged on `main`) but not on `web/integrated`'s `server/`; their paths are already in the list above and
  `publicReadCacheControl` is tested for them, so they pick up the limiter and headers when that branch is merged.
* **Operations**: set Netlify's/Render's CDN to honour `s-maxage` (Render does not cache; put Cloudflare or Netlify's edge
  in front of the API, or have the Next server be the only reader, which is the case today). Raise
  `READ_LIMIT` only with a reason; 1000 per 15 minutes is about 1 per second per address.

## 7. The performance smoke test and CI

`tests/e2e/performance.spec.ts` runs in the normal end-to-end suite (`npm run test:e2e`, both the desktop and the Pixel 7
projects) against the production build, unthrottled, so CI picks it up with no workflow change. Per page (`/en`, a holy
site, the shop, the candle page, the gallery) it asserts: LCP < 2.5 s, CLS < 0.1, images < 1 MB, JavaScript < 350 kB,
fonts < 250 kB, zero video fetched by the home hero at every width; and that photos and videos carry a
long `Cache-Control` and that an anonymous request gets no `Set-Cookie`. The limits are the Core Web Vitals "good" values
and generous byte budgets, chosen so a normal run has a wide margin (LCP is 0.1-0.2 s locally) and only a real
regression fails: a 2 MB hero photo, the 21 MB film, a font that re-wraps the title. Tighten them when the numbers
above improve. Lighthouse itself is not a CI step (it needs a browser path and takes minutes); run
`tests/qa/lighthouse.mjs` before a release.

## 8. What was not verified, and follow-ups

* Real devices and real networks: all numbers are lab numbers on one Windows machine. Lighthouse's mobile score is a
  simulation.
* The hero film on Safari/iOS and Firefox (not run; the tour is H.264, which both play). A phone never gets it.
* Captions for the tour, the interview and the prayer recording (needs a human transcript).
* The Firebase uploads of the tour (209 MB / 93 MB) and interview (39 MB) were **not** done; the pages still stream the
  originals (811 MB, 69 MB) from Firebase until the owner uploads the new files (section 4).
* A 1080p original of the aerial film (the file on Firebase is 640x360), and licensed or own photos to replace the
  soft ones in `public/images/{latin,greek,mary,old,nazareth}`.
* HTML caching: switching the CSP from nonces to hashes (section 4) would let a CDN cache the pages; needs a security
  review.
* Adaptive streaming (HLS) for the tour; needs a video host or CDN.
* The gallery page loads about 1 MB of photos on a phone because Chrome loads lazy images further ahead on a slow
  connection; a "load more" button or smaller tiles would help.
* `/product/catalog` and the other storefront routes are not in `web/integrated`'s `server/` (section 6).

