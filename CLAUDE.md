# Nazareth Holy Cross — instructions for AI agents

## Mandatory reading, before the first edit

1. `docs/WORKING-AGREEMENT.md`: the rules you follow every time (own branch and worktree, local first, the owner
   approves deploys, verify previews with HTTP 200 before merging Netlify-affecting changes, post-deploy smoke check,
   never print secrets, honest reporting, ask only when blocked, keep the docs updated in the same change).
2. `docs/DESIGN-GUIDE.md`: the master design specification of the public site and the admin dashboard (brand and
   voice, tokens, typography, layout templates, component catalogue, motion, accessibility, RTL, performance
   budgets, security rules for UI, admin rules, definition of done, anti-patterns, how to add a page, a language, a
   component, a category, an image set, an admin page). Every UI change must follow it; its test
   (`web/tests/unit/design-guide.test.ts`) fails when the guide and the code disagree.
3. `docs/ENGINEERING.md`: how the system is built and how a change reaches production.

Also read, for the area you touch: `docs/SECURITY.md`, `docs/ADMIN.md`, `docs/ADMIN-UI.md`,
`docs/ADMIN-RUNBOOK.md`, `docs/DESIGN.md`, `docs/PERFORMANCE.md`, `docs/QA.md`.

## The short version

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
