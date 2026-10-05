# QA of the new website (`web/`)

Branch `qa/full-pass`, first full pass on 2026-10-05. Everything below was run against the **production build**
(`next build` + `next start`), in Microsoft Edge (Chromium, Playwright channel `msedge`). Firefox and WebKit are
**not installed** on the machine, so they were not run; only Chromium is covered.

The shop (`/shop`, `/wishlist`, product pages) was being rebuilt by another team during this pass and was only
smoke-tested from the outside (the page answers, one `<h1>`, the cart works in two tabs).

## 1. Test plan

| Dimension | Values |
|---|---|
| Languages (11) | en fr es de it pt pl ru el he ar (he and ar are right-to-left) |
| Routes (16 + 404) | `/`, `/sites`, `/sites/{latin,greek,maryswell,oldcity,city}`, `/tour`, `/about`, `/candle`, `/donate`, `/checkout`, `/cart`, `/reviews`, `/live`, an unknown path |
| Legacy addresses | `/latin /greek /maryswell /oldcity /city /product/:id /checkoutcandle /checkoutdonation`, and every route without a language prefix |
| Viewports | desktop 1366x768, tablet 768x1024, phone 390x844, small phone 360x640; plus 320x256 (400 % zoom) and 683x384 (200 % zoom) |
| Browser | Edge (Chromium). Firefox/WebKit: not installed, not run |
| Flows | language switch, back/forward, mobile menu, photo viewer, review form, candle flow, donation flow, checkout (mocked PayPal and API), cart in two tabs, empty/long/emoji/right-to-left input, double submit, API failure and 429, offline, slow network |
| Preferences | `prefers-reduced-motion`, forced colours (Windows high contrast), JavaScript disabled |

### Per-page checks (the matrix, `tests/qa/matrix.mjs`)

HTTP status, console errors and warnings, uncaught exceptions, failed requests and 4xx/5xx responses, horizontal
scroll, exactly one `<h1>`, heading order, landmarks (`main`, `header`, `footer`, `nav`), `alt` on every image and
that it loads (after scrolling through the page), links/buttons without a name, `<title>`, description, canonical,
hreflang (11 languages + `x-default`), Open Graph and Twitter tags, JSON-LD parses, `lang`/`dir`, text that looks like
an untranslated message key. Then every internal link found is requested and must answer 200.

### Accessibility (`tests/qa/axe.mjs`, `tests/e2e/qa-site.spec.ts`)

axe-core with `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice` on every page in en, he, ar at desktop
and phone width, and in these states: language menu open, phone menu open, photo viewer open, checkout / candle /
donation / review form showing validation errors, cart filled and empty. Colour contrast of every design-token pair
is computed in `tests/qa/contrast.mjs`.

### How to run it

```bash
cd web
export SWC_NATIVE_BINDING_CACHE=C:/Users/<you>/nhc/.swc-cache   # Windows only, see ENGINEERING.md
npx next build && npx next start -p 3603 &
E2E_PORT=3603 PW_CHANNEL=msedge npx playwright test              # regression suite (includes tests/e2e/qa-site.spec.ts)
QA_BASE=http://localhost:3603 PW_CHANNEL=msedge node tests/qa/matrix.mjs    # 11 x 16 x 4 = 704 page loads, ~13 min
QA_BASE=http://localhost:3603 PW_CHANNEL=msedge node tests/qa/axe.mjs
node tests/qa/summarize.mjs ./qa-report "lazy img"                # issues grouped by page
node tests/qa/contrast.mjs                                         # token contrast table
node tests/qa/probe-keyboard.mjs | probe-flows.mjs | probe-forms.mjs   # exploratory probes
node tests/qa/untranslated.mjs                                     # messages identical to English
```

## 2. Results of this pass

| Check | Result |
|---|---|
| Matrix, 704 page loads (11 languages x 16 routes x 4 viewports) | after the fixes: status, `lang`/`dir`, one `<h1>`, landmarks, alt, canonical, hreflang x12, og:image, JSON-LD, no horizontal scroll all clean. Only benign notes remain (see section 4) |
| Internal link crawl | 242 distinct internal links, all 200 |
| axe, 3 languages x 16 routes x 2 viewports + interactive states | 0 violations (all impacts, incl. best-practice) |
| Contrast of every token pair | all text pairs pass 4.5:1 (cream 16.8, gold 11.3, muted 10.5, danger 8.4 on night); field border now 4.5:1 |
| Reflow at 320 px and 200 % zoom (en, he, de, ru x 11 pages) | no horizontal scroll |
| Tab order and focus indicator (14 pages x 2 viewports) | focus always visible; skip link works; mobile menu links are not focusable while closed |
| Reduced motion | content never waits for an animation, no looping animation, no smooth scroll |
| Offline / slow network (600 ms per request) | client navigation keeps working from the cache; candle form usable in 1.4 s, no errors |
| Forms | review form: emoji, Hebrew text, 1500 pasted characters capped at 1000, double-click sends one request; candle with accents/emoji/`+` addresses reaches the order summary; API failure, 429 and network loss are covered by `community.spec.ts` / `payments.spec.ts` |
| Cart | persists across reload, shared between two tabs (storage event) |
| Speed (`tests/qa/probe-perf.mjs`, Edge, phone 4G throttle: CPU x4, 1.6 Mbit/s, 150 ms, cold cache) | LCP 1.3-3.3 s (home 2.9 s, holy-sites list 3.3 s, donate 1.3 s), CLS 0.00-0.09 (home in English 0.088, in Hebrew 0.002), blocking time 60-440 ms; unthrottled desktop LCP 0.15-0.8 s. The home hero video is blocked in this run, see section 4 |
| Translations | 474 keys in every language, none missing; 4-6 values per language equal English (brand name, icon class names, `{count} / {max}`, the cognate "Subtotal") |

Gate at the end of the pass: `npm run lint`, `npm run typecheck`, `npm test` (178 unit tests), `next build`, and the
whole Playwright suite (273 passed, 13 skipped by design: phone-only or desktop-only tests, 286 in total across the
`desktop` and `mobile` projects) all green; `server/` `npm test` 46 passed (the API was not changed).

## 3. Bug log

Severity: **High** = visitors cannot reach content or money is at risk; **Med** = clearly wrong, workaround exists;
**Low** = polish. Every fixed bug has a regression test (listed in the last column).

| ID | Sev | Page | Steps / symptom | Status | Test |
|---|---|---|---|---|---|
| QA-01 | High | every page without a language, and all legacy addresses | `/latin`, `/product/<id>`, `/checkoutcandle`, `/about`, `/shop` answered 404: the matcher in `src/proxy.ts` wrote `\.` in a normal JS string, which is just `.`, so it excluded every path with a character and only `/` reached the language redirect. Old links from search engines and shares were all broken | **Fixed** | `qa-site.spec.ts` routing (2 tests) |
| QA-02 | Med | `/candle`, `/donate`, `/checkout` | no `x-default` hreflang, no `og:image` (so no social card); `og:locale` was `he` instead of `he_IL` on all pages | **Fixed** | `qa-site.spec.ts` metadata |
| QA-03 | Med | `/sitemap.xml` | the five holy-place pages were missing | **Fixed** | `qa-site.spec.ts` |
| QA-04 | Med | whole site | no favicon, touch icon or web manifest: every request for `/favicon.ico` was a 404, browser tabs and home-screen shortcuts had no icon | **Fixed** (`icon.png`, `apple-icon.png`, `favicon.ico`, `manifest.ts`, generated from the logo by `tests/qa/make-icons.mjs`) | `qa-site.spec.ts` |
| QA-05 | Med | language switcher | switching language dropped the query string and `#section`; keyboard focus fell to the page top | **Fixed** | `qa-site.spec.ts` |
| QA-06 | Low | language switcher | Escape closed the menu but left focus on `<body>` | **Fixed** | `qa-site.spec.ts` |
| QA-07 | Med | all forms | text-field border contrast was 1.6:1 (WCAG 1.4.11 needs 3:1) | **Fixed** (`--field-line`, 4.5:1) | `qa-site.spec.ts` |
| QA-08 | Low | any unknown address | the 404 page answers with status 404 and the right content, but the server HTML is an empty shell (`<html id="__next_error__">`, no `lang`) that the browser fills in after loading; the server logs `Internal: NoFallbackError` per request. Seen with `[locale]/[...rest]` and with the unknown-slug case; `force-dynamic` on the catch-all did not change it | **Open** (framework behaviour with a dynamic root layout; needs `global-not-found` (experimental) or a restructure) | `qa-site.spec.ts` asserts the status and `noindex` |
| QA-09 | Med | every page that reads the API | one 429 or 502-504 from the API, and the section (reviews, souvenirs, products) was built empty and kept so until the next revalidation; a production build asks for ~700 pages at once | **Fixed** in `lib/api.ts` (two retries, honours `Retry-After`, 3 s max, never retries a Cloudflare challenge). **Not fixed for the shop**, which has its own fetch in `components/shop/products.ts` (see section 5) | `tests/unit/api.test.ts` (4 tests) |
| QA-10 | Med | all pages except the shop | no error boundary: a rendering error showed Next's bare error page without header or language | **Fixed** (`[locale]/error.tsx` using existing messages, `global-error.tsx`) | `tests/unit/qa.test.tsx` |
| QA-11 | Med | every page with `Reveal` | with JavaScript off (or blocked) all sections stayed at `opacity: 0`: a blank page | **Fixed** (`@media (scripting: none)`) | `qa-site.spec.ts` |
| QA-12 | Low | donation amounts, candle church, current page/step | in Windows high contrast the chosen amount, church and current step looked the same as the others | **Fixed** (system-colour outline) | `qa-site.spec.ts` |

| QA-13 | Med | all photos and sounds in `public/` | served with `Cache-Control: public, max-age=0`: the browser re-asked the server for every image and the 4.8 MB music file on every visit | **Fixed** (`next.config.ts`: 1 day + 7 days stale-while-revalidate for `/images` and `/sounds`) | `qa-site.spec.ts` |
| QA-14 | Low | checkout phone field, Arabic | digits typed on an Arabic or Persian keyboard (`٠٥٢…`) were refused as "not a phone number" | **Fixed** (accepted, and sent to the API as 0-9) | `tests/unit/checkout.test.ts` |

## 4. Open issues and notes

| Sev | Where | Note |
|---|---|---|
| Med | home hero video | `video-7.mp4` is **21 MB** and autoplays on every desktop visit; `tour.mp4` is **851 MB** (loaded only on play, but a phone on mobile data should never be offered it). Re-encode (H.264/AV1, 1080p, ~2-4 MB for the loop, adaptive/HLS for the tour) |
| Med | images | the home hero and several page heroes are small sources stretched over a full-width hero (`nazareth1.webp` 1024x683, `candle.jpg` 640x428, `vitrage-bg.jpg` 612x408, `interview.jpg` 518x445): visibly soft on large and high-density screens. Needs higher-resolution originals |
| Med | videos | no captions or transcript on any video (WCAG 1.2.2); content task |
| Med | caching | every response carries `Set-Cookie: NEXT_LOCALE` (next-intl). Shared caches (Netlify/Cloudflare edge) normally do not cache responses with `Set-Cookie`, so the `s-maxage` of the static pages may not be honoured at the edge. Consider `localeCookie: false` and setting the cookie from the language switcher |
| Low | QA-08 | see bug log |
| Low | home hero | on a slow phone the first visit shows the hero title in the fallback font and re-wraps it when the web font arrives (a 40 px jump of the centred block, layout-shift 0.09-0.10 in en/de at 4G + CPU x4). Fix options: a tighter fallback-font adjustment for EB Garamond, or a fixed `min-height` per line count |
| Low | console | on phone widths Chromium warns that five route CSS files were "preloaded but not used" within a few seconds; harmless, framework-generated |
| Low | SEO | 22 descriptions are longer than 170 characters (fr, es, de, it, el `sites`, `greek`, `latin`, home, about, live) and Google will cut them; the cart descriptions in he/ar/pl are very short (noindex pages) |
| Low | `/cart` | has no `og:image` (noindex page, owned by the shop team) |
| Info | translations | machine-made, still to be reviewed by native speakers (ENGINEERING.md); `contentNaz.modernNazareth.title` is English in Polish |
| Info | not verified | Firefox and Safari engines; real PayPal (never clicked, by rule); screen readers (axe only); real devices |

## 5. Requested changes outside this branch's scope

* `components/shop/products.ts` (shop team) reads products with its own `fetch`; it should use `getJson` from
  `lib/api.ts` so it gets the 429/5xx retry, and a product page that could not load should **throw** during
  build/regeneration (keeping the last good page) instead of caching the "could not load" card.
* The production API sits behind a Cloudflare challenge: from this machine, after many builds and test runs, every
  read answered `429` with `Cf-Mitigated: challenge` (an HTML page). A deploy build that renders ~700 product pages
  and 11 home pages fires that many requests at the API within seconds; fetch the catalogue once per build
  (`/product/catalog`) and pass it down instead of one request per page, or allow-list the build host.
* `shop.spec.ts` reads the live API. During the challenge window (about 80 minutes of this pass) 22 of its tests failed
  because the pages had been built without data; after the API answered again, a clean rebuild passed all of them.
  The suite should read from a stubbed API (as `payments.spec.ts` does) so it does not depend on the network.
