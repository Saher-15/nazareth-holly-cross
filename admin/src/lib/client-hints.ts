// What the dashboard's server tells the API about the visitor (pure, so it is unit-tested).

type HeaderBag = { get(name: string): string | null };

/**
 * The visitor's address to pass on to the API (for its per-address sign-in limit and the audit trail's address hash).
 * Netlify sets x-nf-client-connection-ip itself and overwrites whatever the visitor sent: that is the trusted source.
 * X-Forwarded-For / X-Real-IP are headers the visitor can write, so they are used only when ADMIN_TRUST_XFF=1 says a
 * proxy you control sets them (and local tests, which need a different address per test). Otherwise nothing is sent
 * and the API sees this server's own address.
 */
export function forwardedAddress(h: HeaderBag, trustForwardedFor = process.env.ADMIN_TRUST_XFF === '1'): string {
  const candidate = h.get('x-nf-client-connection-ip') || (trustForwardedFor ? h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') : '') || '';
  return /^[0-9a-fA-F:.]{2,45}$/.test(candidate) ? candidate : '';
}

export function clientHintsFrom(h: HeaderBag, trustForwardedFor?: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  const address = forwardedAddress(h, trustForwardedFor);
  if (address) out['X-Forwarded-For'] = address;
  const ua = h.get('user-agent');
  if (ua) out['User-Agent'] = ua.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300);
  return out;
}
