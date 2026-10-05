import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { NO_STORE } from '@/lib/http';
import { LOCAL_COOKIE, safeNextPath, SECURE_COOKIE } from '@/lib/session';

// GET /api/session/expire: where a page or a call lands when the API says 401. It deletes the (dead) cookie and
// shows the login page. A cross-site navigation here is ignored (nobody can sign an admin out from another site).
const REASONS = new Set(['expired', 'required', 'idle']);

export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';

  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.redirect(url, 303);
  }
  const reason = request.nextUrl.searchParams.get('reason') ?? 'expired';
  if (REASONS.has(reason)) url.searchParams.set('reason', reason);
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  if (next !== '/') url.searchParams.set('next', next);

  const response = NextResponse.redirect(url, 303);
  response.headers.set('Cache-Control', NO_STORE);
  for (const [name, secure] of [[SECURE_COOKIE, true], [LOCAL_COOKIE, false]] as const) {
    response.cookies.set({ name, value: '', maxAge: 0, path: '/', httpOnly: true, secure, sameSite: 'strict' });
  }
  return response;
}
