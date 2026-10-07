import { request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { APP, resetBackend, USERS } from './helpers';

// Resets the backend (mock or real-API harness) to its seed, then signs in once per role through the real BFF route and stores the
// cookies, so most tests start already signed in. (Login, lockout, TOTP and sign-out are tested through the UI.)
export default async function globalSetup() {
  await resetBackend();

  fs.mkdirSync(path.join(__dirname, '.auth'), { recursive: true });
  for (const role of ['owner', 'editor', 'viewer', 'liveeditor', 'liveowner'] as const) {
    const ctx = await request.newContext({ baseURL: APP, extraHTTPHeaders: { Origin: APP } });
    const res = await ctx.post('/api/session/login', { data: { username: USERS[role].username, password: USERS[role].password } });
    if (!res.ok()) throw new Error(`sign-in as ${role} failed: ${res.status()}`);
    await ctx.storageState({ path: path.join(__dirname, '.auth', `${role}.json`) });
    await ctx.dispose();
  }
}
