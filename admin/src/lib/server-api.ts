import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import { ApiError, apiRequest, meSchema, type Me, type Query } from './api';
import { decodeClaims, looksValid, readSessionToken } from './session';

// Server-side access to the admin API for server components and route handlers.
// The token comes from the httpOnly cookie; it is never passed to a client component.

export function apiOrigin(): string {
  return (process.env.ADMIN_API_URL ?? 'http://localhost:3902').replace(/\/+$/, '');
}

export async function getToken(): Promise<string | undefined> {
  const jar = await cookies();
  return readSessionToken(jar);
}

/** Sends the visitor to /api/session/expire (clears the dead cookie) and on to the login page. */
export function goToLogin(reason: 'expired' | 'required' = 'expired', next?: string): never {
  const params = new URLSearchParams({ reason });
  if (next) params.set('next', next);
  redirect(`/api/session/expire?${params.toString()}`);
}

export async function clientHints(): Promise<Record<string, string>> {
  const h = await headers();
  const forwarded = h.get('x-nf-client-connection-ip') || h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || '';
  const out: Record<string, string> = {};
  if (forwarded) out['X-Forwarded-For'] = forwarded;
  const ua = h.get('user-agent');
  if (ua) out['User-Agent'] = ua.slice(0, 300);
  return out;
}

type Call<T> = { path: string; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; query?: Query; schema?: z.ZodType<T> };

/** Calls the API with the session token. 401 clears the session and goes to /login. Other failures throw ApiError. */
export async function serverApi<T = void>(call: Call<T>): Promise<T> {
  const token = await getToken();
  if (!looksValid(token)) goToLogin(token ? 'expired' : 'required');
  try {
    return await apiRequest<T>({ base: apiOrigin(), token, headers: await clientHints(), ...call });
  } catch (error) {
    if (error instanceof ApiError && error.unauthorized) goToLogin('expired');
    throw error;
  }
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Runs a page's data call; API failures become a value the page can render as an error state. */
export async function load<T>(run: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error };
    throw error;
  }
}

export type SessionContext = { user: Me; expiresAt: number | null };

/** The signed-in admin, once per request. Anything but a valid session ends in a redirect to /login. */
export const getSession = cache(async (): Promise<SessionContext> => {
  const token = await getToken();
  const user = await serverApi({ path: '/admin/auth/me', schema: meSchema });
  const exp = decodeClaims(token)?.exp;
  return { user, expiresAt: typeof exp === 'number' ? exp * 1000 : null };
});
