import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, apiRequest } from '@/lib/api';
import { checkSameOrigin } from '@/lib/csrf';
import { BodyTooLarge, jsonResponse, readLimitedText } from '@/lib/http';
import { apiOrigin, clientHints } from '@/lib/server-api';

// POST /api/session/forgot { email }: asks the API to mail a one-time password link (POST /admin/auth/forgot-password).
// The answer is the same 202 { ok: true } whether or not the address has an account; only "too many requests" (429)
// and "the API cannot be reached" (502) differ. The address is never logged.

const bodySchema = z.object({
  email: z.string().trim().min(3).max(254),
});

export async function POST(request: NextRequest) {
  const csrf = checkSameOrigin(request.method, request.headers, request.url);
  if (!csrf.ok) return jsonResponse(403, { error: 'Forbidden' });

  let raw: unknown;
  try {
    raw = JSON.parse(await readLimitedText(request, 2048));
  } catch (error) {
    return jsonResponse(error instanceof BodyTooLarge ? 413 : 400, { error: 'Bad request' });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonResponse(400, { error: 'Bad request' });

  try {
    await apiRequest({
      base: apiOrigin(),
      path: '/admin/auth/forgot-password',
      method: 'POST',
      body: { email: parsed.data.email },
      headers: await clientHints(),
    });
    return jsonResponse(202, { ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 429) {
        const wait = error.retryAfterSeconds ?? 900;
        return jsonResponse(429, { error: 'Too many requests', retryAfter: wait }, { 'Retry-After': String(wait) });
      }
      // Any other 4xx says nothing about the address either: answer like a success.
      if (error.status >= 400 && error.status < 500) return jsonResponse(202, { ok: true });
    }
    return jsonResponse(502, { error: 'Not available right now.' });
  }
}
