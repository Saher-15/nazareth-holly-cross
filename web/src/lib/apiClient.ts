import { API_URL } from './config';

// Browser-side calls to the API (forms, payments). Pages that only read data
// use the server-side helpers in ./api.ts instead.

export type PostResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function postJson<T = unknown>(path: string, body: unknown): Promise<PostResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: 'network' };
  }
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // some endpoints answer with plain text ("Created", "Success")
  }
  if (!res.ok) {
    const error =
      data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `HTTP ${res.status}`;
    return { ok: false, status: res.status, error };
  }
  return { ok: true, data: data as T };
}
