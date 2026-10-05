import type { z } from 'zod';
import { API_URL } from './config';

// Browser-side calls to the API (forms, payments). Pages that only read data
// use the server-side helpers in ./api.ts instead.

export type PostResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

type PostOptions = {
  /** Gives up after this long (reported as status 0, like a lost connection). No limit by default. */
  timeoutMs?: number;
};

/**
 * POSTs JSON to the API. Never throws: a lost connection, a timeout or an unreadable answer all come
 * back as `ok: false` (status 0 means no answer at all). With a `schema` the answer is validated and
 * typed; one that does not match is reported as a 502 instead of being trusted.
 */
export function postJson(path: string, body: unknown, options?: PostOptions): Promise<PostResult<unknown>>;
export function postJson<S extends z.ZodType>(
  path: string,
  body: unknown,
  options: PostOptions & { schema: S },
): Promise<PostResult<z.output<S>>>;
export async function postJson(
  path: string,
  body: unknown,
  { schema, timeoutMs }: PostOptions & { schema?: z.ZodType } = {},
): Promise<PostResult<unknown>> {
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    text = await res.text();
  } catch {
    return { ok: false, status: 0, error: 'network' };
  }

  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // some endpoints answer with plain text ("Created", "Success")
  }

  if (!res.ok) {
    const error =
      typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : `HTTP ${res.status}`;
    return { ok: false, status: res.status, error };
  }
  if (!schema) return { ok: true, data };

  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, status: 502, error: 'unexpected response' };
  return { ok: true, data: parsed.data };
}
