import type { z } from 'zod';
import { ApiError, apiRequest, type Query } from './api';

// Browser-side calls. They only ever go to this app's own /api/proxy route (same origin, cookie attached by the
// browser, token added on the server). A 401 means the session ended: leave through /api/session/expire, which
// clears the cookie and shows the login page.

type Call<T> = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; body?: unknown; query?: Query; schema?: z.ZodType<T> };

export async function proxyCall<T = void>(call: Call<T>): Promise<T> {
  try {
    return await apiRequest<T>({ base: '', ...call, path: `/api/proxy/${call.path.replace(/^\/+/, '')}` });
  } catch (error) {
    if (error instanceof ApiError && error.unauthorized && typeof window !== 'undefined') {
      // A route handler (not a page): it must run on the server to delete the cookie, so a full navigation is right.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/api/session/expire?reason=expired');
    }
    throw error;
  }
}
