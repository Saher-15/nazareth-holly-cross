# How Nazareth Holy Cross is built

This is the rulebook for working on the site: how the code is organised, how a change goes from an idea to
production, and what keeps it safe. Anyone (person or AI agent) changing the code follows it.

## 1. The system

| Part | Folder | Runs on | Notes |
|---|---|---|---|
| Website | `web/` | Netlify, `main` branch | Next.js 16 + TypeScript, next-intl, CSS Modules + design tokens |
| Admin dashboard | `admin/` | Netlify (`nhc-admin-dashboard`), `main` branch | Next.js; talks to the API server to server ([ADMIN.md](ADMIN.md)) |
| API | `server/` | Railway (project `divine-spontaneity`, service `nazareth-holy-cross-api`; Render is suspended since 2026-10-07) | Express + Mongoose. Owns prices, payments, e-mails |
| Database | — | MongoDB Atlas | Products, orders, candles, prayers, reviews, the payment ledger. Cluster0 / database `info`, M10 in Frankfurt with Cloud Backup on (INFRASTRUCTURE.md 6.1), plus the independent copy of [BACKUP.md](BACKUP.md); design, indexes, personal data: [DATABASE.md](DATABASE.md) |
| Product images | — | Firebase Storage | Served through `next/image` (resized, AVIF/WebP) |
| Payments | — | PayPal | **The server decides every amount.** The browser only says *what* is bought |

The previous React site (`client/`) and an abandoned earlier attempt (`client-next/`) were removed from the repository on
2026-10-11; both are in the git history.

Domain, DNS (at Netlify, not GoDaddy), regions, the PayPal Live checklist and the owner's action list:
[INFRASTRUCTURE.md](INFRASTRUCTURE.md). Repositories, branch protection and the plan to make the monorepo private:
[REPOSITORIES.md](REPOSITORIES.md). What is watched and what to do when it breaks: [MONITORING.md](MONITORING.md).
The API answers `GET /health` (the process is up) and `GET /health/deep` (also: MongoDB answers; 503 when it does not).

## 2. Environments

| Environment | URL | Data | PayPal |
|---|---|---|---|
| Local | `localhost` | dev/test DB | Sandbox |
| Preview (per pull request) | Netlify deploy preview | **staging DB (planned)** | Sandbox |
| Production | nazarethholycross.com | production DB | **Live** (to be switched from Sandbox) |

Secrets live only in Railway/Netlify environment settings, never in the repository.

## 3. From idea to production

1. **Branch per change** from `main`: `feat/…`, `fix/…`, `design/…`, `refactor/…`.
2. Build and check **locally** first (`npm run check` in `web/`, `npm test` in `server/`, then `npm run test:e2e`).
3. Open a **pull request** using the template. CI must be green: API tests, web lint + types + unit tests +
   build + end-to-end + accessibility, and the current site still builds.
4. **Review** the deploy preview on a phone width and in an RTL language (Hebrew or Arabic).
5. **Merge** only with the owner's explicit approval. Netlify and Railway deploy `main` automatically.
6. **Smoke-test the live site after every deploy. This step is mandatory, not optional:**

   ```bash
   node ops/smoke-live.mjs        # read-only, about 2 minutes: ~35 pages in a browser, redirects, headers, certificate, API + database
   ```

   Any `FAIL` (exit code 1) means **roll back first, investigate second**. A `WARN` is read, understood and noted in the
   pull request. The same script takes `--site <deploy preview url>` to check a preview *before* merging, and
   `--no-browser` where no browser is installed. What it checks and the runbooks for what it finds:
   [MONITORING.md](MONITORING.md). Then look at the shop and a checkout up to the PayPal button by hand (the script never
   fills a form or presses a payment button).

**Rollback:** Netlify → Deploys → "Publish deploy" on the previous one. Railway → the service → Deployments → the previous successful deploy → Redeploy.
Then revert the commit on `main` with a pull request. A Netlify site that answers 404 on every page after a deploy is a
known failure with its own runbook: [MONITORING.md](MONITORING.md) section 5.1.

## 4. Rules that keep it reliable and safe

- **Never trust the browser with money.** Prices come from the database (`server/services/pricing.js`).
- Every API response is **validated** (`web/src/lib/api.ts`, zod) before the UI uses it.
- Every public form is **rate-limited**; CORS only allows our own sites.
- **No new dependency** without a reason in the pull request; Dependabot keeps them current.
- Security headers are set in `web/next.config.ts`; the Content-Security-Policy (per-request nonce) is built by
  `web/src/proxy.ts` and `web/src/lib/csp.ts`. A new third-party service needs its hosts added there, never a
  looser policy. Threat model, controls and open items: [SECURITY.md](SECURITY.md).
- Structured data (JSON-LD) is always written with `web/src/lib/jsonLd.ts`; raw HTML is never rendered from API data.
- **Nothing paid may be lost.** The server records every PayPal payment in its own ledger before the customer can pay; the browser keeps a paid order in `localStorage` until the API confirms it (docs/DATABASE.md section 2). Any new payment flow follows the same two rules.
- **The database is never changed by the server at start-up.** Indexes are declared in the models and created with `server/scripts/ensure-indexes.js --apply` (dry run by default); a release that needs one says so (docs/DATABASE.md sections 5 and 10). A new text field needs a `maxlength`, a new number a `min`/`max` (a test fails otherwise).
- API input is untrusted: check types, use the helpers in `server/utils/validate.js`, copy named fields only, and
  add a rate limit to any public route that sends mail, calls PayPal or changes data.
- Performance is part of "done" too: see `docs/PERFORMANCE.md` (budgets, how to measure, how images, videos, fonts and
  API reads are handled). `tests/e2e/performance.spec.ts` fails on a regression of LCP, layout shift, or the bytes of
  images, scripts, fonts and the hero film. New hero photos use `getMedia` + `MediaPicture`/`PageHero media`, never a
  small file stretched full-width; a video over 8 MB does not go into the repository.
- Accessibility is part of "done": keyboard reachable, visible focus, alt text, labels, contrast (checked by axe
  in CI), and `prefers-reduced-motion` respected.

## 5. Design system

- Mandatory reading for every change: `docs/WORKING-AGREEMENT.md` (how to work) and `docs/DESIGN-GUIDE.md` (the master
  design specification, with a unit test that keeps it in step with the code).
- Look: **"Immersive pilgrimage"** — night background, gold accents, serif headings, glass cards.
- Tokens (colours, fonts, spacing, type, elevation, focus, motion): `web/src/styles/tokens.css`. Shared blocks (`ui-*`): `web/src/styles/ui.css`.
  Every component, state and rule, with screenshots: **`docs/DESIGN.md`**.
- Components use tokens only — never raw colours or font names.
- Fonts are self-hosted by `next/font`: EB Garamond + Inter (Latin, Cyrillic, Greek), Frank Ruhl Libre + Heebo
  (Hebrew), Amiri + IBM Plex Sans Arabic (Arabic).
- Layout uses **logical CSS properties** (`margin-inline-start`, `inset-inline-end`, `text-align: start`) so
  every page mirrors correctly in Hebrew and Arabic.
- These rules are **checked by tools**, not by memory: `npm run lint` rejects visible text in JSX, anonymous default
  exports and mis-ordered imports; `npm test` rejects raw colours, typeface names and `left`/`right` in CSS
  (`tests/unit/conventions.test.ts`), message keys that do not exist, and new unused messages
  (`tests/unit/i18n-usage.test.ts`).
- Shared building blocks, use them instead of writing another copy: `lib/seo.ts` (`pageMetadata`), `lib/jsonLd.ts`
  + `components/ui/JsonLd`, `components/ui/{Notice,Flame,SvgIcon,icons}`, `lib/images.isOptimizable`, `lib/motion.ts`,
  `lib/time.ts`. The code review that introduced them is in `docs/REVIEW.md`. Every page builds its metadata with
  `pageMetadata` (hreflang for all languages + x-default, `og:locale` from `ogLocale`) and its JSON-LD with
  `lib/jsonLd.ts` (`webPageJsonLd`, `breadcrumbJsonLd`, `faqJsonLd`, ...); `tests/unit/security.test.ts` enforces it.
- Navigation lives in `lib/site.ts`: `mainNav` (header), `footerNav` (Explore), `pilgrimNav` (Plan and discover),
  `legalNav` + `creditsPage` (Help and legal). The sitemap, the footer and the site search read the same lists.
- `/gallery` is one page: the licensed photos (`data/media.ts`, see `docs/MEDIA.md`) grouped by topic, a filter by
  holy site, and the lightbox that names the photographer; `/credits` lists every author and licence.

## 6. Languages

- 14 languages: en (default), fr, es, de, it, pt (Brazilian), pl, ru, uk, ro, nl, el, he, ar. Every URL carries
  its language: `/he/shop`. The list, the names in the language menu and the Open Graph codes are in
  `web/src/i18n/routing.ts`; adding a language means a message file, a line there, and `npm test`.
- Texts live in `web/src/messages/<locale>.json` (ICU format, e.g. `{count}`). English is the fallback.
  Use ICU plurals (`{count, plural, one {…} other {…}}`) for anything with a number; never glue strings together.
- Approved wording per language is in `docs/GLOSSARY.md`; open questions for native speakers are in
  `docs/TRANSLATION-REVIEW.md`. Nothing has been proofread by a native speaker yet.
- A unit test fails if any language misses a key, changes a placeholder (also inside plural branches), has an
  invalid message, leaves a plural form out (ru/uk/pl/ar/ro), mixes Latin letters into Cyrillic/Greek/Hebrew/Arabic
  words, leaves English text behind, or uses Arabic-Indic digits or invisible characters.
- Numbers, prices and dates are formatted with `Intl` (`numberingSystem: 'latn'`: Western digits in every
  language), prices in USD, dates in Nazareth time (`Asia/Jerusalem`).
- `src/proxy.ts` sends a visitor of a bare address (`/`, `/shop`) to their language: the NEXT_LOCALE cookie
  (the language they chose), then Accept-Language, then English. A URL that names a language is never
  redirected. Robots get English for a bare address. `tests/unit/proxy.test.ts` documents the rules.
- SEO per page: canonical, hreflang for every language plus x-default, `og:locale` (+ alternates) and
  `inLanguage` in the JSON-LD (`src/lib/seo.ts`, `src/data/places/seo.ts`); the sitemap lists every language
  version of every page with reciprocal alternates.

## 7. Working on Windows (local quirk)

If `next build` fails with `ERR_SWC_NATIVE_CACHE`, set a writable cache folder first:

```bash
export SWC_NATIVE_BINDING_CACHE="C:\Users\<you>\nhc\.swc-cache"
```

If Playwright cannot download its browser, run the tests with an installed one: `PW_CHANNEL=msedge npm run test:e2e`.

## 8. Roadmap

1. **Foundations** — CI, tests, this rulebook, security headers, languages. *(in progress)*
2. **New site page by page** in `web/` with the chosen design, each page with e2e tests; switch Netlify to `web/`
   when every page matches or beats the current one.
3. **Staging** environment (a second Railway service + Atlas DB + PayPal sandbox) so previews never touch production data.
4. **PayPal Live** with webhook verification; one admin login; error tracking (Sentry) and uptime monitoring.
5. **Growth** — native translation review, SEO (structured data), image optimisation, analytics with consent.

## Payment/security maintenance (2026-10-07)

`server` development uses Node native watch (`npm run dev`), removing nodemon and its vulnerable glob dependency. All three projects expose `npm run security:audit`; CI audits production and development dependencies. Web/admin lint preload the bounded braces guard. Its sole advisory exception expires 2026-11-06 and must be removed when upstream releases a patch. No dependency was added.

`node server/scripts/repair-payments.js --help` describes the new operator tool. Run from `server/` with the same protected database/PayPal configuration as other maintenance tools. Default: read-only PayPal comparison; `--apply`: repair verified completed ledger rows, create missing orders/candles from saved drafts and rotate lastCheckedAt. It never invokes capture. Review output first; do not use production credentials in tests.
