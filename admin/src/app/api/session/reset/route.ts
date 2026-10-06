import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, apiRequest } from '@/lib/api';
import { checkSameOrigin } from '@/lib/csrf';
import { BodyTooLarge, jsonResponse, NO_STORE, readLimitedText } from '@/lib/http';
import { RESET_TOKEN, resetFailureFrom } from '@/lib/password-reset';
import { apiOrigin, clientHints } from '@/lib/server-api';
import { LOCAL_COOKIE, SECURE_COOKIE } from '@/lib/session';

// POST /api/session/reset { token, password }: sets a new password with the one-time link from the e-mail
// (POST /admin/auth/reset-password). 204 on success; 400 { error: 'link' } for a link that is invalid, used or expired;
// 400 { error: 'policy', reason, message } for a password the policy refuses; 429 { retryAfter }; 502 otherwise.
// Neither the token nor the password is ever logged or sent back. No session cookie is set: the person signs in next.
// A session cookie this browser still holds is cleared, since the API has just ended every session of the account.

const bodySchema = z.object({
  token: z.string().max(100),
  password: z.string().min(1).max(200),
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
  const { token, password } = parsed.data;
  // A token of the wrong shape can never be valid: no need to ask the API.
  if (!RESET_TOKEN.test(token)) return jsonResponse(400, { error: 'link' });

  try {
    await apiRequest({
      base: apiOrigin(),
      path: '/admin/auth/reset-password',
      method: 'POST',
      body: { token, password },
      headers: await clientHints(),
    });
    const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': NO_STORE } });
    for (const [name, secure] of [[SECURE_COOKIE, true], [LOCAL_COOKIE, false]] as const) {
      response.cookies.set({ name, value: '', maxAge: 0, path: '/', httpOnly: true, secure, sameSite: 'strict' });
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 400) return jsonResponse(400, resetFailureFrom(error.message));
      if (error.status === 429) {
        const wait = error.retryAfterSeconds ?? 900;
        return jsonResponse(429, { error: 'Too many attempts', retryAfter: wait }, { 'Retry-After': String(wait) });
      }
    }
    return jsonResponse(502, { error: 'Not available right now.' });
  }
}
