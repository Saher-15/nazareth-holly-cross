# Responsive check: the public site and the admin dashboard

Every page of the public site (`web/`) and of the admin dashboard (`admin/`) is checked automatically on phones,
tablets, laptops and wide screens, at 200% zoom and on a phone held sideways, in English and in the two right-to-left
languages (Hebrew, Arabic). The rules are in `docs/DESIGN-GUIDE.md` section 4.2.1; this page is the matrix, how to
run it and the result of the first full pass (2026-10-06, branch `fix/responsive`).

## 1. The matrix

| Viewport (CSS px) | What it stands for | CI | Full |
|---|---|---|---|
| 320 x 568 | small phone (iPhone SE 1st gen), 400% zoom of a 1280 px screen | yes | yes |
| 360 x 740 | common Android phone | | yes |
| 375 x 812 | iPhone | yes | yes |
| 390 x 844 | iPhone 12-15 | | yes |
| 414 x 896 | large phone | | yes |
| 768 x 1024 | tablet, portrait | yes | yes |
| 1024 x 768 | tablet, landscape | | yes |
| 1280 x 800 | laptop | yes | yes |
| 1440 x 900 | laptop, large | | yes |
| 1920 x 1080 | desktop | | yes |
| 640 x 400 at pixel ratio 2 | 200% browser zoom on a 1280 x 800 laptop | | yes |
| 844 x 390 | phone held sideways | overlays | yes |

Languages: en, he, ar on every page. Phones and tablets are emulated with touch.

**Public site, 31 routes:** `/`, `/sites`, the five holy sites (`/sites/latin` only in CI), `/tour`, `/about`,
`/shop`, a product page (the first product of the live catalogue), `/cart` (with two items), `/checkout`,
`/wishlist`, `/candle`, `/donate`, `/plan`, `/visit`, `/gallery`, `/gospel`, `/prayers`, `/reviews`, `/live`,
`/contact`, `/search?q=nazareth`, `/faq`, `/privacy`, `/terms`, `/shipping-returns`, `/credits`, and an unknown
address (the 404 page). The browser talks to nothing but the local site: every request that leaves localhost is
aborted (the server still reads the catalogue from the API, read-only, through its five-minute cache). Nothing is
submitted and no pay button is touched.

**Admin, 22 screens:** the dashboard, orders, an order drawer (`/orders?open=<id>`), candle requests, messages,
payments, products (table and grid), a new product, a product form, reviews (both tabs), prayers, users, audit log,
security settings, profile, privacy requests, the not-found page, and signed out: sign in, forgotten password, reset
password. Against the mock API (`admin/mock-api`), signed in as the spare owner `tempowner` (an account of the seed
that no other test uses), so the spec has its own share of the API's limit of 300 requests per 15 minutes per admin.
Each screen is loaded once per language and measured at every viewport by resizing the window.

## 2. What is checked on every page and viewport

`web/tests/e2e/responsive-audit.ts` (shared by both specs) measures, in the browser:

| Check | Fails when |
|---|---|
| Sideways scroll | `document.scrollingElement.scrollWidth` is wider than the window |
| Off-screen content | a visible element pokes out of the window on either side and no ancestor clips or scrolls it (in RTL, content lost off the left edge counts too) |
| Clipped text | a box with `overflow: hidden` cuts its own text or a child's text (an ellipsis or a line clamp is allowed) |
| Distorted media | an `<img>` or `<video>` drawn with `object-fit: fill` in a box of another shape than the file (more than 3%) |
| Tables | a table wider than the window that is not inside its own scrolling box |
| Tap targets | a link or control under 24 x 24 px (WCAG 2.5.8) that is not inline in a sentence and has a neighbour within 24 px. Targets between 24 and 44 px on touch screens are listed as advice (test annotation), not failures |
| Header | below 1100 px (site) / 960 px (admin) the menu button is not visible; two header controls overlap; a header control leaves the window |
| Fixed and sticky layers | they cover more than a third of the window, a narrow one covers more than 30% of it over the content, or the page `<h1>` starts under the sticky header |

And on 320 x 568, 375 x 812 (site) and 844 x 390, in en and he, the overlays: the phone menu, the language list, the
search palette, the shop's filter drawer and the photo viewer (site); the navigation panel and an order drawer
(admin) must fit inside the window, scroll when they are taller than it, and let you reach their last entry.

## 3. How to run it

```bash
# public site, from web/ (build first; the spec starts `next start` itself unless E2E_PORT points at a running one)
E2E_PORT=3830 PW_CHANNEL=msedge npx playwright test tests/e2e/responsive.spec.ts --project=desktop     # CI sample
RESPONSIVE_FULL=1 E2E_PORT=3830 PW_CHANNEL=msedge npx playwright test tests/e2e/responsive.spec.ts --project=desktop
RESPONSIVE_SHOTS=responsive-shots ...   # adds full-page screenshots at 375, 768 and 1440 px in en and he
RESPONSIVE_REPORT=report.jsonl ...      # appends every problem and every touch-target advice as JSON lines

# admin, from admin/ (build first; the config starts the mock API and `next start`)
PW_CHANNEL=msedge npx playwright test tests/e2e/responsive.spec.ts --project=desktop
RESPONSIVE_FULL=1 RESPONSIVE_SHOTS=responsive-shots PW_CHANNEL=msedge npx playwright test tests/e2e/responsive.spec.ts --project=desktop
```

Both specs are part of `npm run test:e2e` (CI sample: 12 site tests of 27 pages each plus 6 overlay tests, about a
minute locally with 4 workers; 3 admin tests of 22 screens x 4 viewports plus 4 overlay tests, under a minute). They
run in the `desktop` project only and are skipped in `mobile`, because they set their own viewport. Screenshots go
to `responsive-shots/` (git-ignored in both apps). Read the screenshots by eye: the spec checks geometry, not taste
(awkward wrapping, a giant gap, a heading that reads badly).

## 4. Results of the first pass (2026-10-06)

Full matrix: public site 36 tests (12 viewports x 3 languages, 31 pages each, 1,116 page checks) and 6 overlay
tests; admin 3 tests (22 screens x 12 viewports each, 792 screen checks) and 4 overlay tests. Screenshots reviewed by
eye: 186 of the site (31 pages x 375 / 768 / 1440 px x en, he) and 126 of the admin.

### Found and fixed

| ID | Where | Viewport, language | Problem | Fix |
|---|---|---|---|---|
| R-01 | site, language list (every page) | up to about 390 px, every language | the 320 px list hung from the button's end edge started 36 px (320 px screen) or 13 px (375 px) off the other edge: a column of languages was cut off | below 480 px a full-width fixed panel under the header (`LanguageSwitcher.module.css`) |
| R-02 | site, product page top bar | 414 px, en | the wishlist and cart pills ran 19 px off the screen | the bar wraps, the pills keep to the end edge (`shop.module.css`) |
| R-03 | site, shop toolbar | phones, every language | the search placeholder was cut after "Search pro" / "חיפוש מוצרי" | the clear-button room is only reserved once text is typed, ellipsis otherwise (`ShopBrowser.module.css`) |
| R-04 | site, candle / checkout / donate steps | 375 px and less, en | "CONFIRMATION" broke as "CONFIRMATIO / N" | `overflow-wrap: break-word` + `hyphens: auto`, tighter letter-spacing below 400 px (`checkout.module.css`) |
| R-05 | site, candle / checkout / donate | every width, he | eyebrow, step labels and PayPal title were letter-spaced in Hebrew (the guide forbids it) | the Arabic reset now covers Hebrew too |
| R-06 | site, footer (every page) | 476-999 px and 1000 px and wider, every language | the e-mail address broke inside the word ("...@gmail. / com") | the contact column spans two columns, or is as wide as the address (`SiteFooter.module.css`, one class added in `SiteFooter.tsx`) |
| R-07 | site, product cards | every width, he and ar | English product names clamped to two lines lost their start instead of their end ("...oil and incense of") | `unicode-bidi: plaintext` on the name (`ProductCard.module.css`) |
| R-08 | site, product page | 560-859 px (tablet portrait) | the square photo filled the screen and pushed price and cart button below the fold | 4:3 frame there, the photo is contained, never cropped (`ProductDetail.module.css`) |
| R-09 | site, home page | phones | 120-130 px holes between sections (fixed 64-96 px paddings) | fluid `clamp()` paddings, unchanged from about 900 px |
| R-10 | site, `/plan` walking times, `/visit` weather | phones | the table caption ran off with the scrolling columns, cut mid-word | the caption text stays in the visible part of the box and wraps (`.captionText`) |
| R-11 | site, shop toolbar, product photo, zoom, wishlist heart | every width (production build) | a hand-written `-webkit-backdrop-filter` twin made the minifier drop the standard property: no blur in Chrome and Edge (the anti-pattern of DESIGN-GUIDE section 13) | twins removed |
| R-12 | site, header (every page) | 400 px and less, he and ar | the shortened brand name lost its first letters ("...h Holy Cross") instead of its end | `unicode-bidi: plaintext` on the name (`SiteHeader.module.css`) |
| A-01 | admin, phone menu | 960 px and less, he and ar | the navigation panel never opened in Hebrew and Arabic: `html[dir='rtl'] .sidebar` outranked `.sidebar[data-open='true']`, so the open panel stayed off the screen; the whole dashboard was unusable on a phone or tablet in RTL | the RTL selector repeated on the open rule (`admin.css`) |
| A-02 | admin, products grid | every width with columns narrower than 246 px (1024, 1280, ...), every language | the photo's natural width widened the card's column: the stock badge was cut off at the end edge | `grid-template-columns: minmax(0, 1fr)` on the card (`data.css`) |
| A-03 | admin, dashboard "Top products" | 320 px; he and ar (25 px off the left edge), en (16 px past the right) | a `nowrap` name and the sales figure widened the list past its panel; the page scrolled sideways | `minmax(0, 1fr)` on the list and its rows |
| A-04 | admin, dashboard charts | phones, before the chart measured itself (he: page 673 px wide at 320) | the server draws the chart 640 px wide; also its 280 px minimum overflowed a 256 px panel | the drawing scales down to its box; the pointer is mapped back to drawing units (`TimeSeriesChart.tsx`) |
| A-05 | admin, order / candle / message drawers | every width | the e-mail link was a 21 px-high target with neighbours (WCAG 2.5.8) | 24 px (`data.css`) |
| A-06 | admin, phone menu | reduced motion | the panel still slid in (the open state set its own transition) | no transition under reduced motion |
| A-07 | admin, dashboard | every width | the unpaid-orders alert touched the first figure card | spacing between them |

After the fixes the full matrix passes on both apps with no problem left.

### Not fixed (and why)

- **Touch targets between 24 and 44 px** (advice, they pass WCAG 2.2 AA): the wishlist heart on product cards
  (42 px), the quantity stepper buttons, the "Open" card links of the guide pages (24 px high), the inline links of the
  footer-like lists in he/ar (24 px), the holy-site names on `/sites` (34 px); in the admin the names in lists
  (25-27 px) and the brand link. Making them 44 px changes the look of several components; left for a design decision
  (the accessibility branch `feat/a11y-aa` may take it).
- **The product page keeps 56 px free under "Add to cart"** for the confirmation message, so the page does not jump
  when it appears: a deliberate gap.
- **The admin dashboard shows Next's bare "This page couldn't load" page when the API answers 429** (seen when the
  owner's budget ran out during a parallel test run) instead of the rate-limited `<ErrorState>`. Not a layout
  problem; reported, not changed here.

### Not verified

Firefox and Safari engines (only Chromium/Edge is installed), real phones and tablets, iOS Safari's dynamic toolbar,
the eleven other languages beyond en, he and ar (their sideways scroll is checked at the default viewports by
`web/tests/e2e/qa-site.spec.ts`), and real browser zoom (emulated by the 640 x 400 viewport at pixel ratio 2).
