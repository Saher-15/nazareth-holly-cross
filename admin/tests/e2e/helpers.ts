import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { totpCode } from '../../mock-api/totp.mjs';

export const APP = `http://localhost:${process.env.E2E_PORT ?? 3901}`;
export const HARNESS = process.env.E2E_BACKEND === 'harness';
export const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? process.env.E2E_MOCK_PORT ?? (HARNESS ? 3912 : 3902)}`;

// Throw-away accounts of the backend under test (mock-api/seed.mjs and server/test-harness/seed.mjs use the same
// ones, so the suite runs unchanged against either). They exist nowhere else.
export const USERS = {
  owner: { username: 'owner', password: 'Owner-Mock-Pass-1' },
  editor: { username: 'editor', password: 'Editor-Mock-Pass-1' },
  viewer: { username: 'viewer', password: 'Viewer-Mock-Pass-1' },
  secure: { username: 'secure', password: 'Secure-Mock-Pass-1', secret: 'JBSWY3DPEHPK3PXP' },
  locktest: { username: 'locktest', password: 'Locktest-Mock-Pass-1' },
  passchange: { username: 'passchange', password: 'Passchange-Mock-Pass-1' },
  totpsetup: { username: 'totpsetup', password: 'Totpsetup-Mock-Pass-1' },
  resetpass: { username: 'resetpass', password: 'Resetpass-Mock-Pass-1', email: 'resetpass@example.com' },
  // The editor of the live specs (live.spec.ts, live-recordings.spec.ts): the Live page polls its lists, and with the
  // rest of the suite on `editor` the API's 300 requests per admin per 15 minutes ran out.
  liveeditor: { username: 'liveeditor', password: 'Liveeditor-Mock-Pass-1' },
  // ... and their owner: their clean-up between tests (as an owner) used up `owner`'s allowance for the pages that follow.
  liveowner: { username: 'liveowner', password: 'Liveowner-Mock-Pass-1' },
} as const;

export type Role = 'owner' | 'editor' | 'viewer';

export function stateFile(role: Role | 'liveeditor' | 'liveowner'): string {
  return path.join(__dirname, '.auth', `${role}.json`);
}

export function code(secret: string, offsetSteps = 0): string {
  return totpCode(secret, Date.now() + offsetSteps * 30_000);
}

export async function loginUi(page: Page, user: { username: string; password: string }, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Signs in through the form and waits until the dashboard is showing (the cookie is set by then). */
export async function signIn(page: Page, user: { username: string; password: string }) {
  await loginUi(page, user);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
}

/** Collects Content-Security-Policy violations and uncaught page errors while a test runs. */
export function watchProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' || /content security policy|refused to/i.test(text)) {
      // 401/403 answers of deliberate negative tests are logged by the browser as errors; they are not page bugs.
      if (/status of (401|403|404|428|429)/.test(text)) return;
      problems.push(text);
    }
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

export async function expectNoAxeViolations(page: Page, tags: string[] = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']) {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary, 'axe violations').toEqual([]);
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page is wider than the viewport').toBeLessThanOrEqual(1);
}

/** Back to the seed data: every account, lock, session and rate-limit counter of the backend under test. */
export async function resetBackend() {
  const res = await fetch(`${API}${HARNESS ? '/__harness/reset' : '/__mock/reset'}`, { method: 'POST' });
  expect(res.ok).toBeTruthy();
}

/** The mails the backend would have sent (the mock records them, the harness's fake mailer does). */
export async function sentEmails(): Promise<{ to: string | string[]; subject: string; text?: string }[]> {
  const res = await fetch(`${API}${HARNESS ? '/__harness/emails' : '/__mock/emails'}`);
  expect(res.ok).toBeTruthy();
  return res.json();
}

/** Makes the backend's mailer fail (an SMTP outage) or work again. */
export async function setMailFailure(fail: boolean) {
  const res = await fetch(`${API}${HARNESS ? '/__harness/mail' : '/__mock/mail'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fail }) });
  expect(res.ok).toBeTruthy();
}

let ipCounter = 0;
/** A fresh client address for the API's per-address sign-in limit (sent as X-Forwarded-For through the app). */
export const freshIp = () => `10.77.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;
