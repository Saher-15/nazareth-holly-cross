import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { totpCode } from '../../mock-api/totp.mjs';

export const APP = `http://localhost:${process.env.E2E_PORT ?? 3901}`;
export const MOCK = `http://127.0.0.1:${process.env.E2E_MOCK_PORT ?? 3902}`;

// Mock-only accounts (mock-api/seed.mjs). They exist nowhere else.
export const USERS = {
  owner: { username: 'owner', password: 'Owner-Mock-Pass-1' },
  editor: { username: 'editor', password: 'Editor-Mock-Pass-1' },
  viewer: { username: 'viewer', password: 'Viewer-Mock-Pass-1' },
  secure: { username: 'secure', password: 'Secure-Mock-Pass-1', secret: 'JBSWY3DPEHPK3PXP' },
  locktest: { username: 'locktest', password: 'Locktest-Mock-Pass-1' },
  passchange: { username: 'passchange', password: 'Passchange-Mock-Pass-1' },
  totpsetup: { username: 'totpsetup', password: 'Totpsetup-Mock-Pass-1' },
} as const;

export type Role = 'owner' | 'editor' | 'viewer';

export function stateFile(role: Role): string {
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

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary, 'axe violations').toEqual([]);
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page is wider than the viewport').toBeLessThanOrEqual(1);
}

export async function resetMock() {
  const res = await fetch(`${MOCK}/__mock/reset`, { method: 'POST' });
  expect(res.ok).toBeTruthy();
}
