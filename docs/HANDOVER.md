# Handover: continuing the work from another computer (written 2026-10-07, brought up to date 2026-10-11)

No secrets are in this file or in the repository. Passwords, tokens and keys live in Railway, Netlify, Atlas and Cloudflare (see "Where things live").

## Get the code
```
git clone https://github.com/Saher-15/nazareth-holly-cross.git
cd nazareth-holly-cross
```
Read first: `CLAUDE.md`, `docs/WORKING-AGREEMENT.md`, `docs/ENGINEERING.md`, `docs/DESIGN-GUIDE.md`.
Install: `npm ci` in `web/`, `admin/` and `server/` (Node 22). On Windows set `SWC_NATIVE_BINDING_CACHE` to a writable folder if the build says ERR_SWC_NATIVE_CACHE, and `TURBOPACK_ROOT` to the folder above the repo.
Run everything locally without any database: `server/test-harness/serve.mjs` (in-memory API with seed data and accounts: `server/test-harness/README.md`), then `web` (`NEXT_PUBLIC_API_URL=http://127.0.0.1:3912 npm run build && npx next start`) and `admin` (`ADMIN_API_URL=http://127.0.0.1:3912`).

## State of the project
- Production (main): public site, admin dashboard at https://admin.nazarethholycross.com, API on **Railway** (Render is suspended since 2026-10-07). Everything built so far is merged except the open pull requests below.
- Open pull requests (2026-10-11), each merged with the current `main` that day and waiting for the owner:
  - `fix/perf-seo-a11y` (PR #52): performance, SEO and site accessibility findings (smaller JavaScript, product pages indexed once, form error summaries).
  - `fix/content-i18n` (PR #50): 810 reviewed translation fixes and factual corrections. Its message files were merged key by key with the candle sales page texts.
  - `fix/admin-review` (PR #53): the dashboard review findings (broadcast survives navigation, order search, unlock, drafts, verified revenue). Needs `REVALIDATE_SECRET` on Railway and Netlify (see the PR).
  - Dependabot: #12 (Next and React), #13, #16 to #19 (GitHub Actions), refreshed on 2026-10-11; check their CI before merging.
- Done since this file was first written: the security audit of 2026-10-10 (docs/QA.md), the candle sales page and the anonymous sales funnel (docs/ANALYTICS.md, the dashboard's "Campaigns" page), the old `client/` and `client-next/` folders removed.
- Still to do after those: the pilgrim UX fixes (planner logic and calendar time zone, checkout keeps its fields, search synonyms like "rosary", gallery "read about" links, an empty live page), Arabic items (PayPal button language, reversed number ranges), review moderation decision (reviews are published immediately).
- Merge routine used so far: wait for CI green, check the Netlify deploy preview answers 200, merge with the owner's GitHub account, confirm the merge commit is on `main`, wait for the production deploy, run `node ops/smoke-live.mjs`. After any merge error check `main` and the Netlify deploys (a webhook was missed once: Netlify > Deploys > Trigger deploy).

## Where things live (accounts are the owner's)
- GitHub repository: Saher-15/nazareth-holly-cross (public; `main` is protected: pull request + checks). Dependabot, secret scanning and private vulnerability reporting are on.
- Netlify: project `nazarethholycross` (site, base `web`) and `nhc-admin-dashboard` (dashboard, base `admin`). DNS for nazarethholycross.com is at Netlify (GoDaddy is only the registrar).
- Railway: project `divine-spontaneity`, service `nazareth-holy-cross-api` (root `/server`, deploys `main`) and service `hermes` (the 24/7 watcher, docs/MONITORING.md). The API's variables hold DATABASEURL, JWT_SECRET, the PayPal keys (live), MAIL_FROM / MAIL_APP_PASSWORD (Gmail app password), CF_ACCOUNT_ID / CF_STREAM_API_TOKEN. Render: suspended, kept only as history (docs/INFRASTRUCTURE.md).
- MongoDB Atlas: project Nazareth-Holy-Cross, cluster Cluster0 (M10, Frankfurt, Cloud Backup on), database `info`.
- Cloudflare: Stream for live broadcasts and recordings (account owner's).
- First dashboard owner: created by "Forgot password" for nazarethholycross@gmail.com (see `docs/ADMIN-RUNBOOK.md`).

## Owner decisions still open
Opening hours and Mass times; an official contact address; who receives donations; the privacy policy rewrite (Cloudflare, Gmail, recordings, payment ledger, controller, retention) and consent before publishing recordings of people (`docs/TODO-LEGAL.md`); Bible edition per language (`docs/TRANSLATION-REVIEW.md`); translated product names (needs a feature); wine/liquid shipping rules; delete `ADMIN_PASSWORD` on Render after PR #49 is live; consider `REQUIRE_PAYMENT_PROOF=true`; MongoDB M10 cost vs a cheaper tier; repository private + archive old repos (`docs/REPOSITORIES.md`).

## Working with Claude Code on the new computer
Rules of this project: work on localhost first; one branch per change; never commit to `main` directly; never post real data to the production API in tests; PayPal is LIVE (never click pay buttons in tests); use `docs/WORKING-AGREEMENT.md`. The agent memory on the old computer is not in the repository: this file is its replacement.
