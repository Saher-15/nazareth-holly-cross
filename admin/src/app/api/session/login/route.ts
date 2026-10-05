import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, apiRequest, loginResponseSchema } from '@/lib/api';
import { checkSameOrigin } from '@/lib/csrf';
import { BodyTooLarge, jsonResponse, NO_STORE, readLimitedText } from '@/lib/http';
import { apiOrigin, clientHints } from '@/lib/server-api';
import { cookieSpecFor, normalizeExpiresIn, sessionCookieOptions } from '@/lib/session';

// POST /api/session/login: the browser sends the credentials here (same origin), this handler calls the API's
// POST /admin/auth/login and keeps the token in an httpOnly cookie. The token is never in the response body.

const bodySchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
  totp: z.string().trim().max(12).optional(),
});

export async function POST(request: NextRequest) {
  const csrf = checkSameOrigin(request.method, request.headers, request.url);
  if (!csrf.ok) return jsonResponse(403, { error: 'Forbidden' });

  let raw: unknown;
  try {
    raw = JSON.parse(await readLimitedText(request, 4096));
  } catch (error) {
    return jsonResponse(error instanceof BodyTooLarge ? 413 : 400, { error: 'Bad request' });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonResponse(400, { error: 'Bad request' });
  const { username, password, totp } = parsed.data;

  try {
    const result = await apiRequest({
      base: apiOrigin(),
      path: '/admin/auth/login',
      method: 'POST',
      body: { username, password, ...(totp ? { totp } : {}) },
      headers: await clientHints(),
      schema: loginResponseSchema,
    });
    const response = NextResponse.json({ user: result.user }, { headers: { 'Cache-Control': NO_STORE } });
    const spec = cookieSpecFor(request.url, request.headers);
    response.cookies.set({ ...sessionCookieOptions(spec, normalizeExpiresIn(result.expiresIn)), value: result.token });
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      // 401 is identical for an unknown user, a wrong password and a locked account: never say which.
      if (error.status === 401) return jsonResponse(401, { error: 'Invalid credentials' });
      if (error.status === 428) return jsonResponse(428, { error: 'totp_required' });
      if (error.status === 429) {
        const wait = error.retryAfterSeconds ?? 900;
        return jsonResponse(429, { error: 'Too many attempts', retryAfter: wait }, { 'Retry-After': String(wait) });
      }
    }
    return jsonResponse(502, { error: 'Sign-in is not available right now.' });
  }
}
