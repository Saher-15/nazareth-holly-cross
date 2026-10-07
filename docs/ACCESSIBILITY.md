# Accessibility: WCAG 2.2 AA audit, the accessibility panel and the statement

What the public site (`web/`) does for accessibility, how it is checked, what was found and fixed in the audit of
2026-10-06, and what is still open. The public, translated summary of this file is the accessibility statement at
`/accessibility` (`web/src/app/[locale]/accessibility/page.tsx`, texts in `pilgrim.legal.accessibility`, review date
`A11Y_REVIEWED` in `web/src/components/pilgrim/LegalDocument.tsx`). Keep the two in step: when a gap below is closed
or a new one found, update both and the review date.

Design rules live in `docs/DESIGN-GUIDE.md` (section 7, the checklist; section 5.5, the accessibility panel; section
3.2, the contrast tables including high contrast).

## 1. What we claim

**Partially conforms to WCAG 2.2 level AA** (the level Israeli Standard IS 5568 refers to). Every page we build
passed the checks in section 3 in English, Hebrew and Arabic at desktop and phone width; "partially" because of
content we do not control or have not produced yet (section 5). We do not claim "fully conforms" because that
needs testing with real assistive technology and the gaps in section 5 closed.

Accessibility coordinator (named in the statement): the site's e-mail address, `CONTACT_EMAIL` in
`web/src/lib/config.ts` (nazarethholycross@gmail.com).

## 2. The accessibility panel

A round button with the international accessibility sign (the United Nations figure with open arms in a circle)
floats in the bottom corner of every page at the start of the line: bottom left in left-to-right languages, bottom
right in Hebrew and Arabic (the back-to-top button has the other corner). It opens a small non-modal dialog above
itself (`web/src/components/layout/A11yPanel.tsx`): text size 100 / 125 / 150 / 175 / 200%, high contrast, underlined
links, stop animations, readable font, more text spacing (the WCAG 1.4.12 values), strong focus ring, large pointer,
reset, and a link to the statement (which is also linked from the footer). Details and rules for new components:
`docs/DESIGN-GUIDE.md` section 5.5.

Where it sits and why (moved out of the header on 2026-10-07, branch `feat/navbar-logo`):

- It is rendered right after the header, in its own landmark (`<aside>` named "Accessibility"), so the keyboard
  reaches it early and a screen reader finds it in the landmarks list; visually it floats, 48px, 16px from the edges
  plus the screen's safe areas, and does not move while the page scrolls.
- It never covers what the keyboard reaches (2.4.11): `html { scroll-padding-bottom }` keeps focused elements above the
  band of the two corner buttons (twice as high on a phone while the home page's candle pill lifts them), and the
  footer's last line ends above that band, so at the end of a page nothing sits under them.
- It never covers the home page's "light a candle" pill (on phones it steps up above it, as back to top does) nor a
  toast (on narrow screens toasts sit above the corner buttons).
- The open phone menu covers it and makes it inert, with the rest of the page.
- The panel keeps its behaviour: non-modal dialog, focus to the text size, Escape and the close button return the
  focus to the button, clicking or tabbing elsewhere closes it; it opens above the button, never under the header,
  and scrolls inside itself.

How it is built, in short:

- Settings in `localStorage` (`nhc.a11y.v1`), validated on read, `try/catch` around every access, kept in memory
  when storage is blocked, synchronised across tabs (`web/src/lib/a11y.ts`). No cookie; nothing leaves the browser.
- Applied as `data-a11y-*` attributes on `<html>`; the CSS is in `web/src/styles/tokens.css` (high contrast,
  readable font) and `web/src/styles/globals.css` (the rest). High contrast redefines the colour tokens, so every
  component follows without its own rules.
- A 600-byte ES5 script in the `<head>` sets the attributes before the first paint. It carries the request's CSP
  nonce, like Next's own scripts, so the strict policy (`script-src 'nonce-…' 'strict-dynamic'`, no `unsafe-inline`)
  is unchanged. If React re-renders `<html>` and drops the attributes (it does on the not-found page), the panel puts
  them back.
- The system setting `prefers-reduced-motion` is always honoured; "Stop animations" adds the same for visitors who
  cannot change it, and `prefersReducedMotion()` (`web/src/lib/motion.ts`) reports both to the code that starts the
  hero film, the scroll reveals, page transitions, carousels and the live countdown.
- Moving backgrounds have their own pause button (`<MotionToggle>`): the home hero (film and Ken Burns zoom) and
  every `<PlaceHero>` (the five holy sites, the sites index, tour, about, contact, credits, gallery, gospel, plan,
  prayers, visit).
- No third-party overlay or external script.

## 3. How it is checked

| Check | Tool | Scope |
|---|---|---|
| axe-core, tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa` | `web/tests/e2e/a11y.spec.ts` (in `npm run test:e2e`) and `web/tests/qa/a11y-audit.mjs` | every route (33 + one live product page) x en, he, ar x desktop (1366) and phone (390 / Pixel 7), plain and with every panel mode on (200% text, high contrast, underlined links, stopped motion, readable font, spacing, strong focus, large pointer) |
| Reflow, 1.4.10 | `web/tests/qa/a11y-audit.mjs` | every route x en, he, ar at 320 px, plain and with every mode: no sideways scroll |
| Text on photographs, gradients and glass, 1.4.3 (axe reports these as "incomplete") | `web/tests/qa/a11y-probe.mjs` | each such text node is photographed with the text made transparent and its colour compared with every background pixel; the darkest/lightest 10% decide; every route x en, he x desktop and phone, and en, ar with every mode |
| Focus visible and not obscured, 2.4.7 and 2.4.11 | `web/tests/qa/a11y-probe.mjs`, `web/tests/e2e/a11y.spec.ts` | Tab through every route (up to 90 stops) x en, he, ar x desktop and phone: an outline or shadow on every focused element, never entirely covered by the sticky header or a floating button |
| Text spacing, 1.4.12 | `web/tests/qa/a11y-probe.mjs` | the WCAG test values forced on every element of every route x en, he, ar x desktop and phone; any text cut by a box that hides overflow is reported (scrolling boxes such as carousels and wide tables excepted) |
| Error identification, 3.3.1 / 3.3.3 | `web/tests/e2e/a11y.spec.ts` | contact, prayers, reviews, candle, donate and checkout forms sent empty in en and ar: every invalid field has error text linked with `aria-describedby`, focus goes to the first problem, axe clean |
| Pause, stop, hide, 2.2.2 | `web/tests/e2e/a11y.spec.ts` | the home and holy-site pause buttons stop the film and the zoom; "Stop animations" leaves no infinite animation and no film |
| The panel | `web/tests/unit/a11y.test.tsx`, `web/tests/e2e/a11y.spec.ts` | storage validation, the pre-paint script against the TypeScript (same attributes for good, broken and hostile values), keyboard (open, radio arrows, switches, Escape returns focus), persistence before the first paint with no CSP violation, 200% text on a phone in Arabic, high-contrast colour ratios (AAA) |
| Header fit | `web/tests/e2e/a11y.spec.ts` | the bar never overflows in any of the 14 languages at 320 to 1366 px |
| The floating button | `web/tests/e2e/a11y.spec.ts` | not in the header, in its landmark; 16px from the bottom and the start edge in en and he; never meets back to top; the panel opens above it inside the window; on a phone it clears the home page's candle pill; the open phone menu makes it inert |
| The Christian calendar on `/live` (a WAI-ARIA grid) | `web/tests/e2e/calendar.spec.ts`, `web/tests/unit/calendar.test.tsx` | axe on the section with a day of feasts chosen; one tab stop, arrows (mirrored in he and ar), Home/End, Page Up/Down, focus following the chosen day; every day named with its feasts and their tradition (no colour-only marks); 320 px in Arabic (`docs/LITURGICAL-CALENDAR.md`) |
| By eye | screenshots | home, statement, candle and a holy site at 1366 and 390 px in en, he and ar, panel open, 200% text, high contrast, all modes |

How to run:

```bash
cd web
export SWC_NATIVE_BINDING_CACHE=C:/Users/<you>/nhc/.swc-cache TURBOPACK_ROOT=C:/Users/<you>/nhc
npx next build && npx next start -p 3871 &
E2E_PORT=3871 PW_CHANNEL=msedge npx playwright test tests/e2e/a11y.spec.ts
QA_BASE=http://localhost:3871 PW_CHANNEL=msedge node tests/qa/a11y-audit.mjs          # axe + 320 px, plain and with modes
QA_BASE=http://localhost:3871 PW_CHANNEL=msedge node tests/qa/a11y-probe.mjs          # contrast on photos, focus, spacing (about an hour)
QA_CHECKS=contrast QA_SETTINGS=all QA_LOCALES=en node tests/qa/a11y-probe.mjs          # the same with every panel mode on
```

In Git Bash set `MSYS_NO_PATHCONV=1` when passing `QA_ROUTES=/...`, or the paths are rewritten.

## 4. Results of the audit (2026-10-06)

### 4.1 Before the changes (main at `2582351`)

axe found **no violations** on any of the 198 page scans (33 routes x 3 languages x 2 widths), and nothing scrolled
sideways at 320 px: earlier QA passes had already fixed what axe can see. The findings below come from the checks axe
cannot make and from reading the code.

| WCAG | Finding | Where | Fix |
|---|---|---|---|
| 2.2.2 Pause, stop, hide | The home hero film (a 16 s loop on screens 768 px and wider) and the Ken Burns zoom (infinite) had no pause control; the zoom also runs on phones | home + 15 pages with `<PlaceHero>` | `<MotionToggle>` pause button in each hero; panel "Stop animations" |
| 2.2.2 | The live countdown changes every second | `/live` | without seconds (changes once a minute) for visitors who asked for less motion |
| 1.4.3 Contrast | Small gold eyebrows on hero photographs measured 1.9 to 4.4:1 over their brightest parts | 12 pages (home, sites, tour, plan, visit, gospel, prayers, contact, candle, privacy, terms, shipping and returns), 18 page/language findings in en and he | dark text halo on hero eyebrows |
| 1.4.3 | Muted hero leads on photographs measured 4.28 and 4.32:1 | gallery, prayers | hero leads cream with the same halo |
| 1.4.3 | Holy-site names on the photo cards ("More holy sites") measured 4.1:1 on a phone | 6 pages with `<PlaceCards>` | dark halo on card names (also on the home carousel) |
| 1.4.11 Non-text contrast | Empty stars of the shop's rating filter at 2.3:1; unchosen stars of the product review form (a control) at 2.3:1 | shop filters (4 options x 2 languages), product review form | 62% cream, above 3:1 (the filter's text "4 stars and up" carries the meaning anyway) |
| 1.4.4 Resize text | With the text alone enlarged to 200% (the panel, or a browser's minimum font size), digits spilled out of fixed-size circles and pills and sat dark on dark (candle steps, checkout/donate step dots, cart count, filter count, review count, reviewer initials, photo count, product design chips); names on photo cards grew over the bright part of the photo; the brand name filled a quarter of a phone screen | candle, checkout, donate, shop, product, reviews, holy sites, home | circles and pills grow with their text (`max(…px, …em)`, `min-height`); card text on its own dark panel when a panel mode is on; brand name visually hidden on phones at large text (the link keeps its name) |
| 1.4.10 Reflow / 1.4.4 | The header bar was wider than its container in Russian (64 px from 1320 px, 15 px at 1101 to 1116 px) and Ukrainian (49 px from 1240 px): the language button sat outside the page column | header, ru and uk | drawer at 1180 px and below; no bar Donate for pl, ru, el, uk, nl; phone header fits down to 320 px; a test for all 14 languages |
| 1.4.12 Text spacing | Product names clamped to two lines (shop cards, checkout summary), souvenir names and the photo viewer's title cut with an ellipsis, the brand name cut with an ellipsis on phones (from the wrong end in Hebrew and Arabic) | shop, cart/checkout, home, viewer, header | names wrap; the brand name wraps onto two lines |
| 2.4.7 / 2.4.11 Focus | none: 7518 focus stops on every route in en, he, ar at both widths, each with a visible ring and never entirely hidden | | |
| 3.3.1 / 3.3.3 | none: every form names each error in words next to the field | | |
| 3.1.2 Language of parts | none required: the language names in the menus carry `lang`; photographers' names in Hebrew script on the English credits page are proper names (exempt) and are now isolated with `<bdi>` | `/credits` | `<bdi>` |
| Exempt (decorative) | The large outlined "404" and the faint "01"-"05" numbers on the holy-sites index measure under 3:1; both are `aria-hidden` decoration | | none |
| Not WCAG (site rule) | Dates on the legal pages in Arabic used Arabic-Indic digits (the site uses 0-9 everywhere) | privacy, terms, shipping in ar | `numberingSystem: 'latn'` |
| Not WCAG (build pitfall) | Four shop stylesheets still had a hand-written `-webkit-backdrop-filter` twin, which the production minifier keeps instead of the standard property (`docs/DESIGN-GUIDE.md` section 13) | shop bar, product, zoom, wishlist button | twins removed |

### 4.2 After the changes

Measured on the final build of the branch (`next build` + `next start`, Microsoft Edge 1366 x 768 and 390 x 844 /
Pixel 7), with every request leaving the local server aborted:

| Check | Scope | Result |
|---|---|---|
| axe-core, WCAG 2.0/2.1/2.2 A and AA | 34 pages x en, he, ar x desktop and phone, plain and with every panel mode on: 408 page scans (`a11y-audit.mjs`), and the same in `a11y.spec.ts` | 0 violations |
| Reflow at 320 px | 32 routes x en, he, ar, plain and with every mode: 192 page loads | 0 pages scroll sideways (the two data tables scroll inside their own box) |
| Text on photographs, gradients and glass (1.4.3, 1.4.11) | 12,670 text nodes, en and he, both widths, plain | 0 below 4.5:1 (3:1 for large text), except the two `aria-hidden` decorative numerals (exempt) |
| The same with every panel mode on (200% text, high contrast, spacing ...) | 9,247 text nodes, en and ar, both widths; then the 12 routes that had findings again on a phone (1,720 nodes) | the findings of the first run (text spilling out of circles and pills, card names over the bright photo, a floating button covering text) fixed; 0 in the re-run |
| Focus visible and not obscured (2.4.7, 2.4.11) | 7,518 focus stops, every route x en, he, ar x both widths | 0 problems |
| Text spacing (1.4.12) | 124 page loads (en, he, both widths) with the WCAG values forced; 24 more on a phone with 200% text and every mode on top | 0 pieces of text cut off |
| Forms (3.3.1, 3.3.3) | 6 forms x en, ar x both widths | every error in words, linked, focus moved; axe clean |
| Unit tests | `web/tests/unit/a11y.test.tsx` | 33 passed (all 646 unit tests pass) |
| End-to-end | `web/tests/e2e/a11y.spec.ts` | 32 passed, 2 skipped by design (the header-width and focus tests run on the desktop project only); the whole suite: 679 passed, 27 skipped, 0 failed |

Large text needed layout changes beyond the colours (all only while the panel's text size is 150% or more): the
header uses its drawer and hides the brand name on phones, the shop's search bar stacks and stops sticking to the
top, the floating "Light a candle" pill is left out (the same link is in the hero and the menu), the candle form
shows one church per row and the donation form two amounts per row, photo cards grow with their text on a dark
panel, and words may break anywhere so nothing is pushed wider than the screen.

## 5. Known gaps and limits (also in the public statement)

- **PayPal.** The PayPal buttons (an iframe) and PayPal's own window are excluded from our tests and outside our
  control. The statement offers another way by e-mail.
- **Captions.** The recordings of past broadcasts (`/live`) and the tour film (`/tour`) have no captions or
  transcripts (1.2.2, 1.2.3 / 1.2.5). The home hero film is silent and needs none. Writing captions needs the speech
  of each video: a content task for the owner.
- **Translations.** Most texts are machine-made and wait for native review (`docs/TRANSLATION-REVIEW.md`); wording,
  not structure, may suffer (3.1.5 is AAA, but clarity matters).
- **Third-party sites.** Live broadcasts, Google Maps and social profiles open on their own sites.
- **Decorative motion outside the heroes.** The small candle flames and the candle page's glow keep flickering
  unless the visitor asks for less motion (system setting or the panel). They are small decorative effects; the
  panel's "Stop animations", present on every page, is the mechanism that stops them (2.2.2).
- **Wide tables.** The weather table on `/visit` and the walking-times table on `/plan` scroll sideways inside their
  own box on a phone (two-dimensional data, allowed by 1.4.10).

Not verified (no claim is made on them): real screen readers (NVDA, JAWS, VoiceOver, TalkBack), real phones and
tablets, Firefox and Safari engines (all automated runs used Microsoft Edge / Chromium), Windows high-contrast mode
beyond the existing `forced-colors` rules, speech input, and the production build on Netlify.
