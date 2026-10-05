# Admin dashboard (admin/)

The private administration of the Nazareth Holy Cross website: orders, candle requests, messages, products,
reviews, prayers, users and an audit log. A new Next.js 16 + TypeScript app that replaces the old React app
(no login, shared password in the browser). English first, right-to-left ready (Hebrew, Arabic).

```
browser  --cookie-->  admin (Next.js, this folder)  --Bearer token-->  API (server/)  -->  MongoDB
          httpOnly      server components + /api/proxy                  /admin/*  (contract: docs/ADMIN.md)
```

## How it keeps the API token safe (BFF pattern)

* The browser never sees the token. `/login` posts to `/api/session/login` on this app, which calls
  `POST /admin/auth/login` on the server side and stores the JWT in an **httpOnly, SameSite=Strict** cookie
  (`__Host-nhc_admin`, Secure, on any https origin; `nhc_admin` without Secure only on plain-http localhost).
* Pages are server components: they read the cookie and call the API with `Authorization: Bearer`.
  Interactive parts (mark shipped, delete, forms) call `/api/proxy/<resource>`, which adds the token, forwards **only**
  calls on an allow-list (`src/lib/proxy-allow.ts`), drops unknown query parameters and bodies over 64 KB.
* `src/proxy.ts` runs before every page and route: CSRF check (Origin / Sec-Fetch-Site) on every state-changing
  request, redirect to `/login` when signed out, a per-request **nonce Content-Security-Policy** (no `unsafe-inline`,
  no `unsafe-eval`, no framing), `Cache-Control: no-store`, `X-Robots-Tag: noindex` (plus `robots.txt` Disallow all).
* Idle sign-out after 30 minutes (warning dialog for the last 2); the 60-minute API token ends the session too.
  Signing out revokes the session id on the API, so a copied token stops working at once.
* Roles (owner / editor / viewer) are enforced by the API per route. The UI only hides what the API would refuse.

## Run it locally (no real API needed)

```powershell
cd admin
npm install
npm run dev:mock          # terminal 1: the mock of the API contract on http://localhost:3902
$env:ADMIN_API_URL = "http://127.0.0.1:3902"
npm run dev               # terminal 2: the dashboard on http://localhost:3901
```

Worktrees that share a `node_modules` junction need `TURBOPACK_ROOT=<common parent folder>` and, on this PC,
`SWC_NATIVE_BINDING_CACHE=C:\Users\saher\nhc\.swc-cache` (see `next.config.ts`).

Mock accounts (public, mock only - they exist nowhere else): `owner`, `editor`, `viewer` with passwords
`Owner-Mock-Pass-1`, `Editor-Mock-Pass-1`, `Viewer-Mock-Pass-1`; `secure` (owner, two-factor on, secret
`JBSWY3DPEHPK3PXP`, password `Secure-Mock-Pass-1`). More spare accounts for tests are in `mock-api/seed.mjs`.

The mock implements every route of the contract with deterministic seed data: JWT HS256 (60 min), session
revocation, lockout after 5 failures (15 min), a login rate limit (429), TOTP (RFC 6238), role checks per route, audit
log, CSV export with formula-injection protection, request size limits and the product validation. Test hooks:
`POST /__mock/reset`, `GET /__mock/emails` (the "shipped" e-mails it would have sent). Disable with `MOCK_CONTROL=0`.
Knobs: `MOCK_PORT`, `MOCK_LOGIN_LIMIT` (default 8; the contract says 5, but the lockout is also 5 so the lockout
stays visible before the limiter), `MOCK_TOKEN_TTL`, `MOCK_LOCK_MS`.

To point at the real API later set `ADMIN_API_URL` (server-side only, never `NEXT_PUBLIC_`).

## Environment

| Variable | Where | Meaning |
| --- | --- | --- |
| `ADMIN_API_URL` | server | Origin of the API, e.g. `https://api.example.com` (default `http://localhost:3902`) |
| `ADMIN_ALLOWED_ORIGINS` | server | Extra origins allowed to send state-changing requests (default: only itself) |
| `ADMIN_TIMEZONE` | server | IANA zone for printed dates (default `Asia/Jerusalem`) |
| `ADMIN_IMG_SRC` | server | Extra https image hosts for the CSP `img-src` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (+ the other `NEXT_PUBLIC_FIREBASE_*`) | build | Turns on product-photo upload; empty = the form asks for pasted image URLs |

Copy `.env.example` to `.env.local`. Never commit keys. The API needs `ADMIN_ORIGINS` (comma list) only if a browser
ever calls it directly; this app calls it server-to-server. Forward the visitor's IP: the app sends
`X-Forwarded-For` (Netlify's `x-nf-client-connection-ip` first) so the API's per-IP login limit does not treat every
admin as one address - configure the API's `trust proxy` accordingly.

## Scripts

`npm run lint` - `npm run typecheck` - `npm test` (vitest) - `npm run build` - `npm run test:e2e`
(Playwright against `next start` and the mock; `PW_CHANNEL=msedge` reuses the installed Edge) - `npm run check`.
`node scripts/screenshots.mjs [out] [docsDir]` takes the screenshots in `docs/admin-ui/`.

## Tests

* `tests/unit` - API schemas and error mapping, session/cookie rules, CSRF check, CSP builder, proxy allow-list,
  the request gate (`src/proxy.ts`), CSV and TOTP (RFC vectors), QR encoder (decoded by an independent decoder),
  roles, formatting, password policy, product form, i18n completeness.
* `tests/e2e` - login (success, failure, lockout, rate limit, TOTP), redirect when signed out, sign-out revokes the
  token, every page (axe WCAG 2.1 A/AA, no CSP violations, no sideways scroll) on desktop and a phone, the role matrix,
  mark-shipped flow (confirm dialog, e-mail), orders/candles/contacts/reviews/prayers actions, product create/edit/delete,
  user admin, password change, TOTP set-up, idle time-out (fake clock), RTL languages, CSP and cookie flags, no token in
  the page source, local storage or any login answer, CSRF and the proxy allow-list.

## Deploy to Netlify

The admin is its **own Netlify site** (not the public site). `netlify.toml` in this folder names the Next runtime
plugin explicitly - `@netlify/plugin-nextjs`, base `admin` - and sets no secrets. In the site settings: Base
directory `admin`, environment variable `ADMIN_API_URL` (and the Firebase ones if uploads are wanted), custom domain
over https.

**Rule: a deploy preview must answer 200 on `/login` and `/robots.txt` before merging.** Without the plugin Netlify
builds green and then serves 404 everywhere. Also check in the preview: sign-in with a real owner account created by
`node server/scripts/create-admin.js`, the `Content-Security-Policy` response header, and that the cookie is
`__Host-nhc_admin; Secure; HttpOnly; SameSite=Strict`.

Before the first real use: create the first owner with the CLI on the API side, turn on two-factor for every account,
restrict the Firebase Storage rules (the old admin wrote to the bucket without signing in), and retire the legacy
shared-password routes of the API once nothing uses the old admin.

More: `docs/ADMIN-UI.md` (screens, what each role sees, assumptions about the API contract).
