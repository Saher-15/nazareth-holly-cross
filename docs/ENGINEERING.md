# How Nazareth Holy Cross is built

This is the rulebook for working on the site: how the code is organised, how a change goes from an idea to
production, and what keeps it safe. Anyone (person or AI agent) changing the code follows it.

## 1. The system

| Part | Folder | Runs on | Notes |
|---|---|---|---|
| **New website** | `web/` | Netlify (when it replaces `client/`) | Next.js 16 + TypeScript, next-intl, CSS Modules + design tokens |
| Current website | `client/` | Netlify, `main` branch | React (CRA). Kept live until `web/` reaches parity, then retired |
| API | `server/` | Render (`nazareth-holy-cross-api`) | Express + Mongoose. Owns prices, payments, e-mails |
| Database | — | MongoDB Atlas | Products, orders, candles, prayers, reviews |
| Product images | — | Firebase Storage | Served through `next/image` (resized, AVIF/WebP) |
| Payments | — | PayPal | **The server decides every amount.** The browser only says *what* is bought |

`client-next/` is an abandoned earlier attempt and is not deployed.

## 2. Environments

| Environment | URL | Data | PayPal |
|---|---|---|---|
| Local | `localhost` | dev/test DB | Sandbox |
| Preview (per pull request) | Netlify deploy preview | **staging DB (planned)** | Sandbox |
| Production | nazarethholycross.com | production DB | **Live** (to be switched from Sandbox) |

Secrets live only in Render/Netlify environment settings, never in the repository.

## 3. From idea to production

1. **Branch per change** from `main`: `feat/…`, `fix/…`, `design/…`, `refactor/…`.
2. Build and check **locally** first (`npm run check` in `web/`, `npm test` in `server/`, then `npm run test:e2e`).
3. Open a **pull request** using the template. CI must be green: API tests, web lint + types + unit tests +
   build + end-to-end + accessibility, and the current site still builds.
4. **Review** the deploy preview on a phone width and in an RTL language (Hebrew or Arabic).
5. **Merge** only with the owner's explicit approval. Netlify and Render deploy `main` automatically.
6. **Watch** the live site after the deploy (home, shop, a checkout up to the PayPal button).

**Rollback:** Netlify → Deploys → "Publish deploy" on the previous one. Render → the service → Rollback.
Then revert the commit on `main` with a pull request.

## 4. Rules that keep it reliable and safe

- **Never trust the browser with money.** Prices come from the database (`server/services/pricing.js`).
- Every API response is **validated** (`web/src/lib/api.ts`, zod) before the UI uses it.
- Every public form is **rate-limited**; CORS only allows our own sites.
- **No new dependency** without a reason in the pull request; Dependabot keeps them current.
- Security headers are set in `web/next.config.ts`; a full Content-Security-Policy follows once PayPal and
  analytics are ported.
- Accessibility is part of "done": keyboard reachable, visible focus, alt text, labels, contrast (checked by axe
  in CI), and `prefers-reduced-motion` respected.

## 5. Design system

- Look: **"Immersive pilgrimage"** — night background, gold accents, serif headings, glass cards.
- Tokens (colours, fonts, radius, shadow): `web/src/styles/tokens.css`. Shared blocks (`ui-*`): `web/src/styles/ui.css`.
- Components use tokens only — never raw colours or font names.
- Fonts are self-hosted by `next/font`: EB Garamond + Inter (Latin, Cyrillic, Greek), Frank Ruhl Libre + Heebo
  (Hebrew), Amiri + IBM Plex Sans Arabic (Arabic).
- Layout uses **logical CSS properties** (`margin-inline-start`, `inset-inline-end`, `text-align: start`) so
  every page mirrors correctly in Hebrew and Arabic.

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
3. **Staging** environment (Render service + Atlas DB + PayPal sandbox) so previews never touch production data.
4. **PayPal Live** with webhook verification; one admin login; error tracking (Sentry) and uptime monitoring.
5. **Growth** — native translation review, SEO (structured data), image optimisation, analytics with consent.
