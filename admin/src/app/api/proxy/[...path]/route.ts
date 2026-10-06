import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkSameOrigin } from '@/lib/csrf';
import { BodyTooLarge, filterQuery, jsonResponse, NO_STORE, readLimitedText } from '@/lib/http';
import { MAX_PROXY_BODY_BYTES, resolveProxyPath } from '@/lib/proxy-allow';
import { apiOrigin, clientHints } from '@/lib/server-api';
import { looksValid, readSessionToken } from '@/lib/session';

// /api/proxy/<resource>[/<id>]: the browser's only way to the admin API. It adds the Bearer token from the
// httpOnly cookie, forwards only the calls listed in lib/proxy-allow.ts, drops unknown query parameters and
// never forwards cookies or Set-Cookie. The token is never visible to page scripts.

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: Context): Promise<Response> {
  const csrf = checkSameOrigin(request.method, request.headers, request.url);
  if (!csrf.ok) return jsonResponse(403, { error: 'Forbidden' });

  const { path } = await context.params;
  const apiPath = resolveProxyPath(path, request.method);
  if (!apiPath) return jsonResponse(404, { error: 'Not found' });

  const token = readSessionToken(request.cookies);
  if (!looksValid(token)) return jsonResponse(401, { error: 'Unauthorized' });

  let body: string | undefined;
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      const text = await readLimitedText(request, MAX_PROXY_BODY_BYTES);
      // A call without a body (e.g. starting TOTP set-up) is fine; a body must be JSON.
      if (text.length > 0) {
        if (!(request.headers.get('content-type') ?? '').includes('application/json')) return jsonResponse(415, { error: 'JSON only' });
        JSON.parse(text);
        body = text;
      }
    } catch (error) {
      return jsonResponse(error instanceof BodyTooLarge ? 413 : 400, { error: 'Bad request' });
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiOrigin()}${apiPath}${filterQuery(request.nextUrl.searchParams)}`, {
      method: request.method,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: apiPath.endsWith('.csv') ? 'text/csv' : 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(await clientHints()),
      },
      body,
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return jsonResponse(timedOut ? 504 : 502, { error: timedOut ? 'The server took too long to answer.' : 'The server cannot be reached.' });
  }

  const headers = new Headers({ 'Cache-Control': NO_STORE, 'X-Content-Type-Options': 'nosniff' });
  const type = upstream.headers.get('content-type');
  if (type) headers.set('Content-Type', type);
  const disposition = upstream.headers.get('content-disposition');
  if (disposition && apiPath.endsWith('.csv')) headers.set('Content-Disposition', disposition);
  const retryAfter = upstream.headers.get('retry-after');
  if (retryAfter) headers.set('Retry-After', retryAfter);

  return new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
