# Repositories: what exists, what is left, and the target

Audited on 2026-10-06 with read-only `gh` commands and `git log` (no setting was changed). Items marked **owner** need
the owner's GitHub, Netlify or Render login: nothing in this document has been executed on GitHub.

## Status on 2026-10-10 (read this first; sections 1 to 4 are the 2026-10-06 audit, kept as history)

Checked with `gh repo list`, `netlify api listSites` and `railway status` (read-only), then `node ops/smoke-live.mjs`
(75 passed, 0 failed).

- **The project now has one repository: `nazareth-holly-cross` (this monorepo).** The owner deleted
  `nazareth-holly-cross-client` and `nazareth-holly-cross-server` on 2026-10-10 (GitHub can restore a deleted
  repository for 90 days: Settings -> Repositories -> Deleted repositories). `nazareth-holy-cross-admin`,
  `live-nazareth-client` and `live-nazareth-admin` no longer appear on the account either.
- Nothing was lost: the Firebase files of the old client are in `ops/firebase/` (`storage.rules` there is the newer,
  create-only version that is deployed); the old server had nothing to carry over.
- **What deploys from where:** Netlify `nazarethholycross` (public site) and `nhc-admin-dashboard` (new admin) build
  from this monorepo; the API runs on **Railway** from this monorepo, root `/server` (Render is suspended); Hermes runs
  on Railway from the `nousresearch/hermes-agent` image.
- **Netlify:** the old 2024 admin site `nazaretholycrossadmin` was deleted by the owner on 2026-10-10 (its address now
  answers 404; the API had already refused it as an origin). Not part of this project, left to the owner: `forma-store`,
  `urbangents` and `siwarafashionadmin`, whose repositories no longer appear publicly.
- Steps 14 and 15 of the checklist below are done (by deletion instead of archiving); step 7 is replaced by the
  separate `nhc-admin-dashboard` site.
- Step 9 is done (2026-10-11): `client/` and `client-next/` and the `legacy-client` CI job ("Current site (build)") are
  removed; the automatic dependency updates for those folders stop with them.

## 1. Inventory

Account `Saher-15` had 20 repositories on 2026-10-06; six belonged to this project.

| Repository | Visibility | Last push | What it holds | Superseded by the monorepo? |
|---|---|---|---|---|
| **`nazareth-holly-cross`** | **public** | 2026-10-06 | The monorepo: `web/` (live site), `server/` (live API), `admin/` (new dashboard), `docs/`, `client/` (old CRA site), `client-next/` (abandoned) | It is the target. 133 commits, 25 branches, 0 forks, 0 stars, 8 open issues/PRs (mostly Dependabot) |
| `nazareth-holly-cross-server` | private | 2026-08-04 | The old stand-alone API (`Procfile` = Heroku era, models, routes) | **Yes.** `server/` in the monorepo is a rewrite with tests, hardening and the admin API. Nothing to carry over |
| `nazareth-holly-cross-client` | **public** | 2026-08-04 | A Vite/React front end ("Phase 2 redesign: Sacred Parchment theme + admin panel", 72 source files, 408 MB on disk) **plus `storage.rules`, `cors.json`, `firebase.json` of the Firebase bucket** | **Mostly.** The live site is `web/`. 31 of its files do not exist in the monorepo's `client/` (the redesign experiment, in-app admin screens); the monorepo's `client-next/` is the same abandoned line. **Before archiving: the Firebase files were copied to `ops/firebase/`**; the owner confirms the redesign is not wanted |
| `nazareth-holy-cross-admin` | private | 2024-11-14 | The old admin site (React). **Netlify site `nazaretholycrossadmin` is still connected to it** (docs/ADMIN-RUNBOOK.md section 4); the live admin answers 200 today | **Not yet.** Superseded only once `admin/` is live on that Netlify site and used for a few days |
| `live-nazareth-client`, `live-nazareth-admin` | private | 2024-09 | Tailwind front end and admin for the live-stream feature, from September 2024 | **Probably** (the monorepo has `/live` and the live-prayer pages), **not verified.** Owner: confirm nothing is deployed from them (Netlify -> Sites) |
| `nazareth-holy-cross` (no "ly") | - | - | **Does not exist** on the account | - |

Not part of this project: `ai-travel-planner`, `Topaz_World_Cup`, `Topaz-Site-Supervision-Report`, `portfolio`,
`tcp-chat-server`, `saher-15`, `Bank-Management`, `email-to-sheets-automation`, `RAG-System`, `luvera`, `forma`,
`siwarafashion-*`, `siwarafasion-server`.

### What is connected to what

| Service | Connected to | How it was found | Still to confirm (owner) |
|---|---|---|---|
| Netlify site **`nazarethholycross`** (public site) | `nazareth-holly-cross` (monorepo), branch `main`, base directory `web/` | commit statuses `netlify/nazarethholycross/deploy-preview` and Netlify's check runs on the monorepo | Netlify -> Site configuration -> Build & deploy -> Repository |
| Netlify site **`nazaretholycrossadmin`** (admin) | the OLD `nazareth-holy-cross-admin` repository | docs/ADMIN-RUNBOOK.md section 4; the live admin has no CSP header, so it is the old build | same page; re-link to the monorepo with base directory `admin/` when the new dashboard goes live |
| Render service **`nazareth-holy-cross-api`** | most likely the monorepo (`render.yaml`, `rootDir: server`) | not visible from GitHub (Render's GitHub app leaves no webhook or status) | Render -> the service -> Settings -> Build & Deploy -> Repository and branch |
| GitHub webhooks | none on the repository | `gh api repos/.../hooks` returned `[]` | both services use GitHub **apps**, not webhooks |

## 2. Findings in the monorepo today

**Done on 2026-10-06 (owner's go-ahead):** `main` is protected (pull request required, the API, Web, Admin and gitleaks checks
required, no force-push, no deletion; admins can still bypass in an emergency), Dependabot alerts and Dependabot security
updates are on, private vulnerability reporting is on, and merged branches are deleted automatically. Findings 1, 3, 4
and the setting of 6 below are therefore closed; the rest of the table is the state before that.

| # | Finding | Risk | Fix |
|---|---|---|---|
| 1 | **`main` has no branch protection and no ruleset.** Anything can be pushed or force-pushed to production | high | section 4, step 5 |
| 2 | **The required check "Web (lint, types, unit, build, e2e)" is RED on `main`** at the last two merges (#21, #22): `/en/gallery` performance budget (desktop and mobile), QA-11 (no-JavaScript page content, mobile), and one flaky accessibility case (target size of the hero button). Both merges went through because nothing enforced the check | high: turning protection on now would block every merge | fix the three tests first (they belong to the gallery, the no-JavaScript page and the hero button; other branches may already be on them), then protect `main` |
| 3 | GitHub's **private vulnerability reporting is OFF**, yet `SECURITY.md` pointed to it (now: e-mail first, GitHub second) | medium | Settings -> Code security -> Private vulnerability reporting -> Enable (owner) |
| 4 | **Dependabot alerts are disabled** and Dependabot security updates are off (the API answers "Dependabot alerts are disabled"). Version-update PRs work (`dependabot.yml`), but a published vulnerability gives no alert | medium | Settings -> Code security -> enable **Dependabot alerts** and **Dependabot security updates** (owner) |
| 5 | Secret scanning and push protection are **on** (good); 0 open alerts | - | keep. Both stop working for free once the repository is private (section 3) |
| 6 | 25 branches on the remote, many merged or abandoned (`refactor/01..06`, `restore/original-ui`, `web/final`, four Dependabot branches...) | low | delete merged branches; turn on "Automatically delete head branches" |
| 7 | 3 open Dependabot PRs (`actions/checkout`, `setup-node`, `upload-artifact`, `cache`) whose CI fails, because the whole Web job is red (finding 2) | low | after finding 2 is fixed, re-run them; majors of first-party actions are safe to take |
| 8 | History: **no `.env`, key, certificate or service-account file was ever committed** (every path of all 133 commits was listed; every added line of all history was scanned for 11 secret shapes, see below) | - | keep gitleaks in CI |
| 9 | Personal data in the public history: commit e-mails `saher@TopazEngs.local` (a work PC name) and a personal Gmail address, and, in the old public client repository, a second contributor's personal e-mail | low (privacy) | going private removes the exposure for the monorepo; the old public client repository should be made private before archiving |
| 10 | No `README.md`, `CODEOWNERS`, `.gitattributes`, `.editorconfig`, issue templates | low | **added in this change** |
| 11 | CRLF/LF warnings on every commit from Windows | low | **fixed by `.gitattributes`** (`* text=auto eol=lf`). The stored files were already LF (`git ls-files --eol`: 777 LF, 0 CRLF, the rest binary), so no history and no test changes; `git add --renormalize .` produced no content change |
| 12 | Firebase `storage.rules`/`cors.json` lived only in the old public client repository | medium | copied to `ops/firebase/` (deployed state still to be checked, section 6 of docs/INFRASTRUCTURE.md) |

**Secrets scan of the history (what was and was not looked for).** All 133 commits, every added line, patterns: MongoDB
connection strings with credentials, private-key blocks, Google API keys (`AIza...`), PayPal-client-id-shaped strings,
GitHub / Slack / Stripe tokens, Gmail app-password shapes, `JWT_SECRET`/`ADMIN_PASSWORD`/`CLIENT_SECRET`/`DATABASEURL`
assignments, hard-coded `password = "..."` literals, private IP addresses. Result: only placeholders in
`server/.env.example`, fake credentials in tests and the in-memory mock/seed files (all documented as public), package-lock
integrity hashes (they look like keys), and the PayPal **client IDs** (public by design; the sandbox one is allow-listed in
`.gitleaks.toml`). **No real secret was found.** This is a pattern search, not proof: it cannot see a secret in an unusual
shape, and it covers only this repository (the old public `nazareth-holly-cross-client` was checked by file name only:
no `.env*`, key or credential file in 356 commits; its contents were not scanned). The weekly `Security` workflow
(gitleaks, full history) is the standing check.

## 3. Target layout: ONE private monorepo

**Recommendation:** keep `nazareth-holly-cross` as the only repository of the project, make it **private** after the new
admin site is live, archive everything else of the project.

| | Stay public | Make it private |
|---|---|---|
| Source code and docs | visible to everyone, including `docs/SECURITY.md` (threat model, rate limits, open weaknesses), `docs/ADMIN-RUNBOOK.md` (how the owner is created, the Atlas recovery commands) and the whole admin API | visible to the owner and invited people only. The site is a shop and donation page with an admin: the less an attacker can read, the better. The code itself is not secret (the browser downloads the front end anyway) |
| GitHub Actions minutes | unlimited and free | **2,000 free minutes a month** on GitHub Free. One full CI + Security run is about **27 billed minutes** (Web 16 + Admin 5 + API 1 + legacy build 1 + Security ~4; measured on run 37432960539). That is about 70 runs a month; Dependabot PRs and every push to a PR count. A busy week can use it up; then checks stop until the month turns, or each extra minute costs about US$0.008 (about US$0.22 a run). The 10-minute keep-alive job would add 4,320 minutes by itself, so it must go (use an external monitor, `docs/MONITORING.md`) |
| Secret scanning and push protection | free | **not available on the Free plan** (GitHub Secret Protection is a paid add-on). `gitleaks` in CI stays and becomes the only scanner: keep it |
| Dependabot (alerts, security updates, version updates) | free | free |
| CodeQL / code scanning | free | paid add-on (not used today) |
| Deploy integrations (Netlify, Render) | work | work, but each GitHub **app** must be allowed to see the repository (GitHub -> Settings -> Applications -> the app -> Repository access). A deploy that cannot see the repository stops silently. Re-authorise **before** switching, test with a deploy preview |
| Private vulnerability reporting, issues from strangers | possible | not possible for strangers: e-mail and `/.well-known/security.txt` carry the reporting address (done) |
| Forks, stars, community | allowed (today: 0 forks, 0 stars) | existing forks would be detached; nothing to lose today |
| Cost | none | none unless the minutes run out; GitHub Pro (US$4/month) gives 3,000 minutes |
| What is already out | anything ever pushed is permanently public (clones and caches); making it private later does not undo that. The scan found no real secret, so there is nothing to rotate | same |

Honest summary: private costs a few GitHub features and a minutes budget that a trimmed CI fits into
(skip the legacy-client job once `client/` is deleted; run the Web end-to-end only when `web/` changed). Public costs
nothing but gives anyone a map of the system. For a site that takes payments and has an admin back office, private is the
better default. If the minutes become a problem the answer is a US$4 plan or a lighter CI, **not** going back to public.

Other repositories of the project: **archive** (Settings -> Danger zone -> Archive this repository). Archiving is
reversible (Unarchive) and deletes nothing; do not delete any repository until the new admin has run for a month.

## 4. The ordered checklist (owner executes; each step says how to undo it)

**A. Before anything is switched (can be done today)**

1. [ ] **Fix the red Web check on `main`** (finding 2): gallery performance budget, QA-11 no-JS case, hero target size.
       A required check that is already red blocks every merge.
2. [ ] Enable **Dependabot alerts** and **Dependabot security updates**; enable **Private vulnerability reporting**
       (Settings -> Code security). Undo: switch off.
3. [ ] Turn on **two-factor authentication** for: GitHub (`Saher-15`), Netlify, Render, MongoDB Atlas, GoDaddy, PayPal,
       Firebase/Google, the Gmail account of the site. Save the recovery codes offline. A hijacked account of any of them
       is worse than any bug in the code.
4. [ ] Settings -> General -> Pull Requests: **Automatically delete head branches** on; allow squash merging only (one
       commit per change keeps `main` readable). Delete the merged branches listed in finding 6 (`gh pr list --state merged`).
5. [ ] **Protect `main`** (Settings -> Rules -> Rulesets -> New branch ruleset, target `main`, Enforcement: Active):
       - Require a pull request before merging: **on**, required approvals: **0** (a solo owner cannot approve their own
         pull request; "Require review from Code Owners" stays **off** until a second maintainer exists)
       - Require status checks to pass: **on**; add `API (tests)`, `Web (lint, types, unit, build, e2e)`,
         `Admin dashboard (lint, types, unit, build, e2e on the mock and on the real API)`, `Secret scan (gitleaks)`,
         `Dependencies (npm audit) (server)`, `Dependencies (npm audit) (web)`. Do **not** add `Current site (build)`
         once `client/` is deleted. "Require branches to be up to date": **on**
       - Block force pushes: **on**. Restrict deletions: **on**
       - Bypass list: leave empty. In an emergency edit the ruleset, merge, and switch it back (and write why in the pull request)
       Undo: set Enforcement to Disabled. Netlify and Render deploy from `main` and are unaffected.
6. [ ] Open a throw-away pull request (a typo in a doc) and check: the checks run, merging is blocked while red, direct
       push to `main` is refused.

**B. When the new admin site is live and has been used for a few days**

7. [ ] Netlify, site `nazaretholycrossadmin` -> Link to a different repository -> `Saher-15/nazareth-holly-cross`,
       base directory `admin` (docs/ADMIN-RUNBOOK.md section 4; write down the old settings first). Check the deploy
       preview answers 200 on `/login`.
8. [ ] Netlify, site `nazarethholycross` and Render service: confirm the repository and branch they follow (section 1).
9. [x] Delete `client/` and `client-next/` from the monorepo in one pull request (rollback is a revert), and the
       `legacy-client` job of `ci.yml`. They are 94 MB of history that only costs minutes.

**C. Make the monorepo private**

10. [ ] GitHub -> Settings -> Applications -> **Netlify** and **Render** (and Dependabot if listed): Repository access
        must include `nazareth-holly-cross`.
11. [ ] Delete `.github/workflows/keepalive.yml` in a pull request **first** and set up the external uptime monitor
        (docs/MONITORING.md) so the API is not left to sleep. Reason: 4,320 billed minutes a month.
12. [ ] Settings -> General -> Danger zone -> **Change visibility -> Private.** Re-read the warnings GitHub prints.
13. [ ] Immediately: push a trivial change through a pull request and check **both** deploy previews and the Render
        deploy start; run `node ops/smoke-live.mjs` after the merge. If a service shows "repository not found": re-authorise
        it (step 10) and "Clear cache and deploy site".
14. [ ] Make `nazareth-holly-cross-client` (public) **private** now (it still holds personal e-mails and is no longer
        needed), then archive it.

**D. Archive the rest**

15. [ ] Archive `nazareth-holly-cross-server`, `nazareth-holly-cross-client`, `live-nazareth-client`, `live-nazareth-admin`
        (each: Settings -> Danger zone -> Archive). Archive `nazareth-holy-cross-admin` only after step 7 and a week of use.
16. [ ] Rename nothing: the name `nazareth-holly-cross` (double "l") is wired into Netlify, Render, the CORS list and
        the CI badges; a typo is cheaper than a broken deploy. (If it is ever renamed, GitHub redirects the old name, but
        re-check both services.)

**E. Standing hygiene**

17. [ ] Keep `CODEOWNERS` (added). When a second person gets write access: turn on "Require review from Code Owners" and
        one approval.
18. [ ] Once a quarter: `gh repo list Saher-15`, GitHub -> Settings -> Applications (remove apps nobody uses),
        Settings -> SSH and GPG keys / Developer settings -> tokens (delete unused), Netlify and Render team members.
19. [ ] Rotate on any doubt: `JWT_SECRET`, Gmail app password, PayPal secret, Atlas database user password. The
        `Security` workflow runs weekly; read its e-mail.
