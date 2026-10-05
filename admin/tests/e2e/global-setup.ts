import { request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { APP, MOCK, USERS } from './helpers';

// Resets the mock API to its seed, then signs in once per role through the real BFF route and stores the
// cookies, so most tests start already signed in. (Login, lockout, TOTP and sign-out are tested through the UI.)
export default async function globalSetup() {
  const reset = await fetch(`${MOCK}/__mock/reset`, { method: 'POST' });
  if (!reset.ok) throw new Error('mock API did not reset');

  fs.mkdirSync(path.join(__dirname, '.auth'), { recursive: true });
  for (const role of ['owner', 'editor', 'viewer'] as const) {
    const ctx = await request.newContext({ baseURL: APP, extraHTTPHeaders: { Origin: APP } });
    const res = await ctx.post('/api/session/login', { data: { username: USERS[role].username, password: USERS[role].password } });
    if (!res.ok()) throw new Error(`sign-in as ${role} failed: ${res.status()}`);
    await ctx.storageState({ path: path.join(__dirname, '.auth', `${role}.json`) });
    await ctx.dispose();
  }
}
