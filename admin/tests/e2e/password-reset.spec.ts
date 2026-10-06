import { expect, test, type Page } from '@playwright/test';
import { APP, expectNoAxeViolations, freshIp, loginUi, noHorizontalScroll, sentEmails, USERS } from './helpers';

// Forgotten password: /forgot-password mails a one-time link (read here from the backend's recorded mails), the link
// opens /reset-password, the new password works at once and the link works only once. The same against the mock and
// against the real API (npm run test:e2e:harness). The account is the spare `resetpass` (resetpass@example.com).

const ADDRESS = USERS.resetpass.email;
const USERNAME = USERS.resetpass.username;
const SENT = 'If an account uses this address, we sent a link. It works for 30 minutes.';
const BAD_LINK = 'This link is invalid or has expired. Ask for a new one.';

/** The newest reset link mailed to the address, after `since` mails were already there. */
async function linkFor(address: string, since: number): Promise<string> {
  let link = '';
  await expect.poll(async () => {
    const mails = (await sentEmails()).slice(since).filter((m) => [m.to].flat().includes(address));
    link = /(https?:\/\/\S+\/reset-password\?token=[A-Za-z0-9_-]{43})(?:\s|$)/.exec(mails.at(-1)?.text ?? '')?.[1] ?? '';
    return link;
  }).not.toBe('');
  return link;
}

/** Each test uses its own client address (forwarded by the app), so the API's per-address limits never meet. */
async function ownAddress(page: Page) {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': freshIp() });
}

test.describe('forgotten password', () => {
  test('forgot -> link by e-mail -> new password -> sign in; the link then works no more', async ({ page }, testInfo) => {
    await ownAddress(page);
    const newPassword = `Olive-Lamp-${testInfo.project.name}-2026`;

    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeVisible();
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page);

    const before = (await sentEmails()).length;
    await page.getByLabel('E-mail address').fill(`  ${ADDRESS.toUpperCase()} `);
    await page.getByRole('button', { name: 'Send the link' }).click();
    await expect(page.getByRole('status').filter({ hasText: SENT })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();

    const link = await linkFor(ADDRESS, before);
    expect(link.startsWith(`${APP}/reset-password?token=`)).toBe(true);
    const response = await page.goto(link);
    expect(response?.headers()['referrer-policy']).toBe('no-referrer');
    expect(response?.headers()['cache-control']).toContain('no-store');
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a new password' })).toBeVisible();
    // The token leaves the address bar at once, and no Referer would carry it anywhere.
    await expect(page).toHaveURL(`${APP}/reset-password`);
    await expect(page.locator('meta[name="referrer"]').first()).toHaveAttribute('content', 'no-referrer');
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page);

    const fresh = page.getByLabel('New password', { exact: true });
    const repeat = page.getByLabel('Repeat the new password', { exact: true });
    await expect(fresh).toBeFocused();
    await fresh.fill('short');
    await repeat.fill('short');
    await page.getByRole('button', { name: 'Save the new password' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'The password must be at least 12 characters.' })).toBeVisible();
    await fresh.fill(newPassword);
    await repeat.fill(`${newPassword}x`);
    await page.getByRole('button', { name: 'Save the new password' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'The two passwords do not match.' })).toBeVisible();
    // A rule only the server knows (repetition): its message comes back translated.
    await fresh.fill('abababababab');
    await repeat.fill('abababababab');
    await page.getByRole('button', { name: 'Save the new password' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'The password is too repetitive.' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a new password' })).toBeVisible();

    await expect(fresh).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(fresh).toHaveAttribute('type', 'text');
    await fresh.fill(newPassword);
    await repeat.fill(newPassword);
    await page.getByRole('button', { name: 'Save the new password' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Your password was changed' })).toBeVisible();

    // The same link a second time: used.
    await page.goto(link);
    await page.getByLabel('New password', { exact: true }).fill(`${newPassword}-again`);
    await page.getByLabel('Repeat the new password', { exact: true }).fill(`${newPassword}-again`);
    await page.getByRole('button', { name: 'Save the new password' }).click();
    await expect(page.getByRole('alert').filter({ hasText: BAD_LINK })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute('href', '/forgot-password');

    await loginUi(page, { username: USERNAME, password: newPassword });
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  });

  test('an unknown address gets the same answer and no mail; a malformed one is caught first', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once');
    await ownAddress(page);
    await page.goto('/forgot-password');
    await page.getByLabel('E-mail address').fill('not-an-address');
    await page.getByRole('button', { name: 'Send the link' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Enter a valid e-mail address.' })).toBeVisible();

    const before = (await sentEmails()).length;
    await page.getByLabel('E-mail address').fill('nobody-at-all@example.com');
    await page.getByRole('button', { name: 'Send the link' }).click();
    await expect(page.getByRole('status').filter({ hasText: SENT })).toBeVisible();
    expect((await sentEmails()).length).toBe(before);
  });

  test('a link that is not valid, or no link at all, says so and offers a new one', async ({ page }) => {
    await ownAddress(page);
    await page.goto(`/reset-password?token=${'Q'.repeat(43)}`);
    await expect(page).toHaveURL(`${APP}/reset-password`);
    await page.getByLabel('New password', { exact: true }).fill('Some-Valid-Password-77');
    await page.getByLabel('Repeat the new password', { exact: true }).fill('Some-Valid-Password-77');
    await page.getByRole('button', { name: 'Save the new password' }).click();
    await expect(page.getByRole('alert').filter({ hasText: BAD_LINK })).toBeVisible();

    await page.goto('/reset-password');
    await expect(page.getByRole('alert').filter({ hasText: BAD_LINK })).toBeVisible();
    await page.getByRole('link', { name: 'Ask for a new link' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test('works in Hebrew, right to left', async ({ page, context }, testInfo) => {
    await ownAddress(page);
    await context.addCookies([{ name: 'nhc_admin_lang', value: 'he', url: APP }]);
    const newPassword = `Cedar-Path-${testInfo.project.name}-2026`;

    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByLabel('שם משתמש או דוא"ל')).toBeVisible();
    await page.getByRole('link', { name: 'שכחתם את הסיסמה?' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'איפוס סיסמה' })).toBeVisible();
    await noHorizontalScroll(page);

    const before = (await sentEmails()).length;
    await page.getByLabel('כתובת דוא"ל').fill(ADDRESS);
    await page.getByRole('button', { name: 'שליחת הקישור' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'אם קיים חשבון עם הכתובת הזו' })).toBeVisible();

    await page.goto(await linkFor(ADDRESS, before));
    await expect(page.getByRole('heading', { level: 1, name: 'בחירת סיסמה חדשה' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await page.getByLabel('סיסמה חדשה', { exact: true }).fill(newPassword);
    await page.getByLabel('הקלידו שוב את הסיסמה החדשה', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'שמירת הסיסמה החדשה' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'הסיסמה שונתה' })).toBeVisible();
    await page.getByRole('link', { name: 'התחברות' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('שם משתמש או דוא"ל').fill(USERNAME);
    await page.getByLabel('סיסמה', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'התחברות' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'לוח בקרה' })).toBeVisible();
  });
});
