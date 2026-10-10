# Nazareth Holy Cross

The website of the Nazareth Holy Cross community, a place of pilgrimage: visit information, the holy sites, a shop,
candles and donations, live prayer, reviews and prayer requests, in 14 languages. Live at
**https://nazarethholycross.com**.

One repository (a monorepo) holds everything:

| Folder | What it is | Runs on | Status |
|---|---|---|---|
| [`web/`](web/) | The public website. Next.js 16, TypeScript, next-intl, CSS Modules + design tokens | Netlify (site `nazarethholycross`) | **Live** |
| [`server/`](server/) | The API. Express + Mongoose: products, orders, PayPal, candles, contact, prayers, reviews, e-mail, admin API | Railway (project `divine-spontaneity`, service `nazareth-holy-cross-api`; Render is suspended) | **Live** |
| [`admin/`](admin/) | The admin dashboard. Next.js; accounts, roles, two-factor sign-in, audit log | Netlify (its own site) | Built, being rolled out; the old admin site is still live |
| [`docs/`](docs/) | How it is built, secured, measured and operated | - | - |
| [`ops/`](ops/) | Scripts for operating the live site (post-deploy smoke test) | your PC | - |

```
visitor -> Netlify (web/) --server-side and browser--> Railway (server/) --> MongoDB Atlas
                       \--> PayPal (payments)   \--> Firebase Storage (product photos)
admin   -> Netlify (admin/) --server to server--> Railway (server/)
```

The domain `nazarethholycross.com` is registered at GoDaddy; its DNS is answered by Netlify.

## Where to start

- **Changing the code:** [`CLAUDE.md`](CLAUDE.md) (rules for AI agents) and [`docs/ENGINEERING.md`](docs/ENGINEERING.md)
  (how a change reaches production, and the mandatory check after it).
- **Running it on your PC:** `web/README.md`, `docs/ADMIN-RUNBOOK.md` section 1 (dashboard + API with no database and no secrets).
- **Something is down:** [`docs/MONITORING.md`](docs/MONITORING.md) (what to watch, the three failures seen so far).
- **Domain, DNS, hosting, regions:** [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md).
- **Repositories, branch rules, who owns what:** [`docs/REPOSITORIES.md`](docs/REPOSITORIES.md).
- **Security:** [`SECURITY.md`](SECURITY.md) (how to report) and [`docs/SECURITY.md`](docs/SECURITY.md) (threat model, controls).
- **Design, performance, QA, media, translations:** `docs/DESIGN.md`, `docs/PERFORMANCE.md`, `docs/QA.md`, `docs/MEDIA.md`, `docs/GLOSSARY.md`.

## The short rules

1. One branch per change, a pull request, green checks, then merge. **`main` is production: merging deploys.**
2. Work and test locally first; never use the live API or a real PayPal payment for testing.
3. Secrets live only in Railway and Netlify settings, never in the repository.
4. After every deploy run `node ops/smoke-live.mjs` (read-only, about two minutes).

## Checks

```bash
cd web    && npm ci && npm run check && npm run test:e2e     # lint, types, unit tests, build, browser tests
cd server && npm ci && npm test                              # API tests (in-memory fakes, no database)
cd admin  && npm ci && npm run check                         # dashboard
```

Windows tips (a build needing `SWC_NATIVE_BINDING_CACHE`, `PW_CHANNEL=msedge`) are in `docs/ENGINEERING.md` section 7.
