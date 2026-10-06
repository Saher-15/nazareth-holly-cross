// Small helpers for route handlers and the proxy.

export const NO_STORE = 'no-store, no-cache, must-revalidate, max-age=0';

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': NO_STORE, ...headers },
  });
}

export class BodyTooLarge extends Error {}

/** Reads a request body as text, refusing anything over `maxBytes` (declared or actual). */
export async function readLimitedText(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLarge();
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new BodyTooLarge();
  return new TextDecoder().decode(buffer);
}

/** Query parameters the browser may pass to the API through the proxy. Everything else is dropped. */
const ALLOWED_QUERY = new Set(['page', 'size', 'q', 'status', 'sort', 'actor', 'action']);

export function filterQuery(search: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const [key, value] of search) {
    if (ALLOWED_QUERY.has(key) && value.length <= 100) out.set(key, value);
  }
  const text = out.toString();
  return text ? `?${text}` : '';
}
