import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiRequest } from '@/lib/api';
import { checkSameOrigin } from '@/lib/csrf';
import { jsonResponse, NO_STORE } from '@/lib/http';
import { apiOrigin, clientHints } from '@/lib/server-api';
import { LOCAL_COOKIE, readSessionToken, SECURE_COOKIE } from '@/lib/session';

// POST /api/session/logout: revokes the session on the API (so the token stops working at once, even if it was
// copied) and deletes the cookie. A failure to reach the API still clears the cookie.
export async function POST(request: NextRequest) {
  const csrf = checkSameOrigin(request.method, request.headers, request.url);
  if (!csrf.ok) return jsonResponse(403, { error: 'Forbidden' });

  const token = readSessionToken(request.cookies);
  if (token) {
    try {
      await apiRequest({ base: apiOrigin(), path: '/admin/auth/logout', method: 'POST', token, headers: await clientHints(), timeoutMs: 5000 });
    } catch {
      // The cookie is removed below either way.
    }
  }
  const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': NO_STORE } });
  for (const [name, secure] of [[SECURE_COOKIE, true], [LOCAL_COOKIE, false]] as const) {
    response.cookies.set({ name, value: '', maxAge: 0, path: '/', httpOnly: true, secure, sameSite: 'strict' });
  }
  return response;
}
