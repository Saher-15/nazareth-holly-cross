# Working agreement

The rules a person or an AI agent follows **every time** they change anything in this repository. They exist
because the site takes money, holds visitors' prayers and addresses, and deploys to production when `main`
changes. Short version: read first, work on your own branch, test locally, never deploy without the owner's yes,
verify before and after, never print a secret, report only what you really checked, and keep the docs true.

This agreement is mandatory reading together with `docs/DESIGN-GUIDE.md` (what the product looks like and how it
behaves). `CLAUDE.md` at the repository root points here.

## 1. Read these first, every time

Before the first edit, read what applies to your change. If you have already read them in this session and
nothing changed, skim the parts that matter.

| Document | Why |
|---|---|
| `CLAUDE.md` | The short rules |
| `docs/ENGINEERING.md` | How the system is built, environments, how a change reaches production |
| `docs/DESIGN-GUIDE.md` | The master design specification: tokens, components, templates, voice, accessibility, RTL, definition of done |
| `docs/DESIGN.md` | The shell of the site with its specimen screenshots |
| `docs/SECURITY.md` | The threat model, the Content-Security-Policy, what UI and API changes must respect |
| `docs/ADMIN.md`, `docs/ADMIN-UI.md`, `docs/ADMIN-RUNBOOK.md` | The admin API contract, the dashboard's screens and rules, how to run and deploy it |
| `docs/PERFORMANCE.md` | Budgets and how to measure |
| `docs/QA.md` | What is tested, how, and what is known to be open |
| `docs/GLOSSARY.md`, `docs/MEDIA.md` | The approved words per language; the licensed photos |

Next.js 16 differs from older versions (Middleware is now `web/src/proxy.ts`): read the matching guide in
`web/node_modules/next/dist/docs/` before using a framework API you are not sure about.

## 2. The owner's rules

- **Local first.** Work and test on your own machine. Nothing is pushed, merged or deployed without the owner's
  explicit approval for that specific change. An earlier approval does not cover a later change.
- **The owner approves deploys.** Merging to `main` deploys the website (Netlify) and the API (Render)
  automatically, so a merge **is** a deploy.
- **Never** connect to the production database, send real e-mail, click a live PayPal pay button, use real customer
  data in a test, or call write routes of the production API.
- **Never** kill a process you did not start (no `taskkill /IM node.exe`); other agents and the owner run servers on
  this machine. Use your own ports.
- Do not add a dependency without a written reason in the pull request (`docs/ENGINEERING.md` section 4); do not
  install MongoDB on the machine (tests use the in-memory fakes in `server/test-harness`).
- Do not add trackers, analytics, banners, pop-ups, a service worker or any third-party script without an explicit
  decision by the owner (see `docs/DESIGN-GUIDE.md` sections 1.5 and 10).

## 3. One branch per change, in your own worktree

1. Fetch and branch from the latest `main` in a **separate git worktree**, never in the shared checkout and never on
   `main`:

   ```bash
   git -C <main-checkout> fetch origin
   git -C <main-checkout> worktree add ../wt-<name> -b <type>/<short-name> origin/main
   ```

   Branch names: `feat/...`, `fix/...`, `design/...`, `docs/...`, `refactor/...`, `perf/...`.
2. Share the installed packages with junctions instead of running `npm install` (Windows):

   ```bash
   cmd /c mklink /J wt-<name>\server\node_modules <main-checkout>\server\node_modules
   cmd /c mklink /J wt-<name>\web\node_modules <main-checkout>\web\node_modules
   ```

   `admin/` has its own packages: `npm ci` inside `admin/` only when you change it. Remove the junctions
   (`cmd /c rmdir`) before deleting a worktree, otherwise the shared packages are deleted too.
3. Builds in a worktree need two environment variables:
   `SWC_NATIVE_BINDING_CACHE=C:/Users/<you>/nhc/.swc-cache` and `TURBOPACK_ROOT=C:/Users/<you>/nhc`.
4. Never touch other branches or other worktrees. Do not use a bare `git stash` (the stash is shared by all
   worktrees); commit work in progress to your own branch instead.
5. Windows is case-insensitive: never create two files whose names differ only by case.
6. Commit in small steps with messages that say what and why; commit messages and pull request descriptions end with
   the attribution line the tooling gives you. Do not rewrite history that others may have seen.

## 4. Verify locally before asking for a merge

Run the commands of `docs/DESIGN-GUIDE.md` section 12.1 for the parts you changed:

| Changed | Commands |
|---|---|
| `web/` | `npm run lint`, `npm run typecheck`, `npm test`, `npx next build`, `npm run scan:bundle`, then `E2E_PORT=<your port> PW_CHANNEL=msedge npx playwright test` (from `web/`) |
| `server/` | `npm test` (from `server/`) |
| `admin/` | `npm run check` and `npm run test:e2e` (from `admin/`) |
| docs only | `npm test` in `web/` (the design guide test checks the docs) |

Also look at the result with your own eyes on a 1366 px and a 390 px screen, in an LTR and an RTL language, with
the keyboard (`docs/DESIGN-GUIDE.md` section 12.2).

**The live API's rate limit.** The production API allows 200 requests per 15 minutes per address, and everything on
this machine shares it (builds render hundreds of pages that read it). Check before a build or an end-to-end run:
`curl -sI https://nazareth-holy-cross-api-production.up.railway.app/health` and read the `ratelimit` header. A throttled run
shows error states that are not bugs; wait for the window to reset.

## 5. Deploy previews and the Netlify rule

Every pull request gets a Netlify deploy preview. A change that touches how the site is built or served
(`netlify.toml`, `web/next.config.ts`, `web/src/proxy.ts`, redirects, headers, the Next.js version, the Netlify
runtime) can make every page answer 404 in production while the build is green: that already happened (the merge
of the new site, `docs/DESIGN-GUIDE.md` section 13).

**Before merging any such change, verify the preview with HTTP, not with the build log:**

```bash
PREVIEW=https://<preview-url>
for p in /en /he /en/shop /en/sites/latin /en/candle /en/donate /robots.txt /sitemap.xml; do
  printf "%s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "$PREVIEW$p"      # every line must print 200
done
curl -s -o /dev/null -w "%{http_code}\n" "$PREVIEW/en/does-not-exist"            # must print 404
curl -sI "$PREVIEW/en" | grep -i -E "content-security-policy|strict-transport|x-frame-options"   # headers present
```

For the admin dashboard the equivalent is `docs/ADMIN-RUNBOOK.md` section 4: `/login` and `/robots.txt` must
answer 200 on the preview. A `404` anywhere, or a missing CSP header, means the runtime plugin did not run: do not
merge. Then open the preview in a browser on a phone width and in Hebrew.

## 6. After the owner merges: the post-deploy smoke check

Only the owner merges (or tells you in chat to). Right after the deploy finishes, check the live site and report the
result:

```bash
SITE=https://nazarethholycross.com
for p in /en /he /ar /en/shop /en/sites /en/sites/latin /en/candle /en/donate /en/contact /en/privacy /robots.txt /sitemap.xml; do
  printf "%s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "$SITE$p"          # 200 each
done
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/en/does-not-exist"               # 404, not 200
curl -sI "$SITE/en" | grep -i -E "content-security-policy|strict-transport"      # present
curl -sI https://nazareth-holy-cross-api-production.up.railway.app/health | head -1           # 200
```

Then in a browser: the home page, the shop with products visible, a product page, a holy-site page, the candle form
and the checkout **up to the PayPal button** (never click pay), in English and Hebrew, on a phone width. If anything
fails, say so at once and propose the rollback (Netlify: Deploys, "Publish deploy" on the previous one; Render: the
service, Rollback; then revert the commit on `main` with a pull request: `docs/ENGINEERING.md` section 3). Do not
"fix forward" in production without the owner.

## 7. Secrets and personal data

- **Never print a secret**: not in the terminal, a log, a test, a commit, a pull request, a screenshot or a final
  report. That includes the database connection string, JWT secrets, PayPal secrets, API keys and tokens, TOTP
  secrets, admin passwords and session cookies. Refer to them by name (`PAYPAL_SECRET`), never by value.
- Secrets live only in Render and Netlify settings and in local `.env` files that are git-ignored. Do not copy an
  `.env` into a document.
- If a secret appears where it should not (a chat, a ticket, a commit), say so and treat it as leaked: it must be
  rotated by the owner. `.github/workflows/security.yml` (gitleaks) and `npm run scan:bundle` are safety nets, not
  permission.
- Test accounts and credentials in docs are the public mock ones only (`admin/README.md`).
- Personal data of visitors (names, e-mail addresses, addresses, prayers, candle intentions) is never copied into
  tests, screenshots, docs or reports. Use invented data.

## 8. Honest reporting

- Report only checks you actually ran, with the command and the result. "Tests pass" means you saw them pass.
- Say what you did **not** verify (for example: Firefox and Safari engines, real screen readers, real devices,
  real PayPal, the production build on Netlify) and what the owner must do by hand.
- Do not hide a failing or flaky test, do not skip a test to make a run green, do not loosen a budget or a
  rule to pass. If a rule is wrong, say so and propose the change.
- Report problems you find outside your task (legacy copy, open issues) in the report; fix them only if they are
  within the task or you are certain and it is small and documented.
- A final report is short and has these parts: branch and last commit; what was built, found and fixed; test
  counts; what is not verified; what the owner must do by hand.

## 9. Ask only when blocked

Do the work. Make the reasonable decision that is easiest to undo, write it down in the pull request, and continue.
Ask the owner only when you are truly blocked or the decision cannot be undone cheaply:

- a deploy, a merge, a push, a real payment, real e-mail, anything touching production data;
- a new dependency, a new third-party service, a cookie or tracking of any kind;
- a legal text, a price, a shipping fee, a promise to visitors;
- a licence or a photo whose licence is unclear;
- credentials or access you do not have (do not guess or work around access controls).

When you ask, ask once, with the options and your recommendation, and keep working on everything else meanwhile.

## 10. Keep the docs true, in the same change

A change is not finished until the documents that describe it are updated in the same branch:

- a token, a `ui-*` class, a component, a template or a rule changed: `docs/DESIGN-GUIDE.md` (the test in
  `web/tests/unit/design-guide.test.ts` fails if a documented token, class, component, path or key disappears, if a
  contrast number is wrong, or if a token or `ui-*` class is missing from the guide) and `docs/DESIGN.md` for the shell;
- a way the system is built or released changed: `docs/ENGINEERING.md`;
- a security control changed: `docs/SECURITY.md`;
- the admin changed: `docs/ADMIN-UI.md` (screens and roles) and `docs/ADMIN.md` (contract);
- a budget or a measurement changed: `docs/PERFORMANCE.md`; a test or a finding: `docs/QA.md`;
- a new word in a language: `docs/GLOSSARY.md`.

If you find a statement in a document that is wrong, fix it when you are certain, and list the fix in your report.

## 11. Working next to other agents

Several agents and the owner work in this repository at the same time. So: your own worktree and branch, your own
ports (`E2E_PORT`, `-p`), no shared files outside your worktree (use the scratchpad for temporary files), no
global state changes (git config, the stash, system settings), and no assumptions about what is running. If another
agent's change collides with yours, stop and report it rather than overwriting it.

## 12. Checklists

**Start**
- [ ] Read section 1 documents for the area.
- [ ] Own worktree on a fresh branch from `origin/main`; junctions made; environment variables set.
- [ ] API rate limit checked before builds and end-to-end runs.

**Finish**
- [ ] Commands of section 4 run and green (or the failure reported honestly).
- [ ] Looked at on desktop and phone, LTR and RTL, keyboard, reduced motion.
- [ ] Messages in all languages; no hard-coded text; tokens only.
- [ ] Docs updated (section 10); the guide test passes.
- [ ] No secret, no personal data, no production call anywhere in the change.
- [ ] Not pushed, merged or deployed (unless the owner said so in this conversation).
- [ ] Final report written (section 8).
