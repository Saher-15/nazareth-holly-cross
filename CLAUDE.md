# Nazareth Holy Cross — instructions for AI agents

Read `docs/ENGINEERING.md` first. The short version:

- **Owner's rule:** work on localhost only. Never push, merge or deploy without the owner's explicit approval
  for that specific change.
- One branch per change. Never commit to `main` directly.
- New pages go in `web/` (Next.js 16 + TypeScript). Next 16 differs from older versions: read
  `web/node_modules/next/dist/docs/` before using an API (Middleware is now `src/proxy.ts`).
- Use the design tokens in `web/src/styles/tokens.css` and the `ui-*` classes; never hard-code colours or fonts.
  Use logical CSS properties so Hebrew/Arabic mirror correctly.
- All visible text goes through next-intl (`web/src/messages/*.json`, all 14 languages, ICU placeholders).
- Never send real data to the production API while testing, and never click a live PayPal pay button.
- Never kill processes you did not start (no `taskkill /IM node.exe`).
- Done means: `npm run check` and `npm run test:e2e` pass in `web/`, `npm test` passes in `server/`, and the
  change was looked at on desktop and phone width, in an LTR and an RTL language.
- Write `backdrop-filter` alone in CSS, never with a hand-written `-webkit-backdrop-filter` twin: the production CSS
  minifier keeps only the twin and Chrome/Edge lose the blur (see `docs/DESIGN.md`, "Build pitfall").
