// CSRF defence for every state-changing request (anything but GET/HEAD/OPTIONS).
// The session cookie is SameSite=Strict already; this is the second, independent layer:
//   1. Sec-Fetch-Site, when the browser sends it, must be "same-origin".
//   2. Origin must be this site's own origin (or one listed in ADMIN_ALLOWED_ORIGINS).
//   3. A request that carries neither header is refused: every browser sends Origin on a cross-origin POST.

type HeaderBag = { get(name: string): string | null };

export type CsrfVerdict = { ok: true } | { ok: false; reason: string };

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isStateChanging(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

function first(value: string | null): string {
  return (value ?? '').split(',')[0].trim().toLowerCase();
}

export function allowedOriginsFromEnv(value = process.env.ADMIN_ALLOWED_ORIGINS): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/\/$/, ''))
    .filter(Boolean);
}

export function checkSameOrigin(method: string, headers: HeaderBag, requestUrl: string, extraOrigins: string[] = allowedOriginsFromEnv()): CsrfVerdict {
  if (!isStateChanging(method)) return { ok: true };

  const site = first(headers.get('sec-fetch-site'));
  if (site && site !== 'same-origin') return { ok: false, reason: 'cross-site request' };

  const origin = first(headers.get('origin'));
  if (!origin) {
    // Some same-origin fetches omit Origin; they still carry Sec-Fetch-Site: same-origin (checked above).
    return site === 'same-origin' ? { ok: true } : { ok: false, reason: 'missing origin' };
  }
  if (origin === 'null') return { ok: false, reason: 'opaque origin' };

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return { ok: false, reason: 'malformed origin' };
  }
  const host = first(headers.get('x-forwarded-host')) || first(headers.get('host')) || new URL(requestUrl).host.toLowerCase();
  if (originHost === host) return { ok: true };
  if (extraOrigins.includes(origin)) return { ok: true };
  return { ok: false, reason: 'origin mismatch' };
}
