import { expect, test } from '@playwright/test';
import { APP, code, loginUi, signIn, USERS } from './helpers';

// Password change, two-factor set-up, idle time-out and language: each uses its own mock account.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'state-changing flow: run once');
});

test.describe('security settings', () => {
  test('change password: policy hints, then the new password works and the old one does not', async ({ page, browser }) => {
    await signIn(page, USERS.passchange);
    await page.goto('/settings');
    await page.getByLabel('Current password').first().fill(USERS.passchange.password); // the first form (the second sets up two-factor)
    await page.getByLabel('New password', { exact: true }).fill('short');
    await page.getByLabel('Repeat the new password').fill('short');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'at least 12 characters' })).toBeVisible();

    await page.getByLabel('New password', { exact: true }).fill('A-Brand-New-Pass-2026');
    await page.getByLabel('Repeat the new password').fill('A-Different-Pass-2026');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'do not match' })).toBeVisible();

    await page.getByLabel('Repeat the new password').fill('A-Brand-New-Pass-2026');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Password changed' })).toBeVisible();

    // another browser: old password refused, new one accepted
    const other = await browser.newContext();
    const page2 = await other.newPage();
    await page2.goto(`${APP}/login`);
    await page2.getByLabel('Username').fill(USERS.passchange.username);
    await page2.getByLabel('Password', { exact: true }).fill(USERS.passchange.password);
    await page2.getByRole('button', { name: 'Sign in' }).click();
    await expect(page2.getByRole('alert').filter({ hasText: 'Wrong username or password.' })).toBeVisible();
    await page2.getByLabel('Password', { exact: true }).fill('A-Brand-New-Pass-2026');
    await page2.getByRole('button', { name: 'Sign in' }).click();
    await expect(page2.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await other.close();

    // this session stayed signed in (only OTHER sessions are revoked)
    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
  });

  test('two-factor: set up with the QR/secret, enable with a code, sign-in then asks for a code, disable again', async ({ page, browser }) => {
    await signIn(page, USERS.totpsetup);
    await page.goto('/settings');
    await expect(page.getByText('Two-factor sign-in is off.')).toBeVisible();
    // Setting up needs the current password again (security review 06, finding 9): none -> the button waits for it,
    // a wrong one -> refused, and no QR code is shown.
    await expect(page.getByText('To set it up, confirm with your current password.')).toBeVisible();
    await expect(page.getByTestId('totp-start')).toBeDisabled();
    const setupPassword = page.getByLabel('Current password').last(); // the second form on the page
    await setupPassword.fill('not-my-password-1');
    await page.getByTestId('totp-start').click();
    await expect(page.getByRole('alert').filter({ hasText: 'The current password is not right.' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'QR code for your authenticator app' })).toHaveCount(0);
    await setupPassword.fill(USERS.totpsetup.password);
    await page.getByTestId('totp-start').click();
    await expect(page.getByRole('img', { name: 'QR code for your authenticator app' })).toBeVisible();
    const secret = ((await page.getByTestId('totp-secret').textContent()) ?? '').replace(/\s+/g, '');
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);

    await page.getByLabel('Authentication code').fill('000000');
    await page.getByRole('button', { name: 'Turn on' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'That code is not right' })).toBeVisible();

    await page.getByLabel('Authentication code').fill(code(secret, -1)); // a code works once and steps only go forward: enable on the previous step,
    await page.getByRole('button', { name: 'Turn on' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Two-factor sign-in is on.' }).first()).toBeVisible();
    await expect(page.getByText('Two-factor sign-in is on.').first()).toBeVisible();

    const other = await browser.newContext();
    const page2 = await other.newPage();
    await page2.goto(`${APP}/login`);
    await page2.getByLabel('Username').fill(USERS.totpsetup.username);
    await page2.getByLabel('Password', { exact: true }).fill(USERS.totpsetup.password);
    await page2.getByRole('button', { name: 'Sign in' }).click();
    await expect(page2.getByLabel('Authentication code')).toBeVisible();
    await page2.getByLabel('Authentication code').fill(code(secret)); // sign in on the current one,
    await page2.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(page2.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await other.close();

    await page.reload();
    await page.getByLabel('Current password').last().fill(USERS.totpsetup.password); // the second form on the page
    await page.getByLabel('Authentication code').fill(code(secret, 1)); // turn off on the next one
    await page.getByRole('button', { name: 'Turn off' }).click();
    await page.getByRole('dialog', { name: 'Turn off two-factor sign-in?' }).getByRole('button', { name: 'Turn off' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Two-factor sign-in is off.' })).toBeVisible();
  });
});

test.describe('idle time-out', () => {
  test('a warning two minutes before, "Stay signed in" resets, 30 idle minutes sign out', async ({ page }) => {
    await page.clock.install();
    await loginUi(page, USERS.viewer);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    const warning = page.getByTestId('idle-warning');
    await expect(warning).toBeHidden();
    await page.clock.fastForward('28:30');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('signed out in');
    await warning.getByRole('button', { name: 'Stay signed in' }).click();
    await expect(warning).toBeHidden();

    await page.clock.fastForward('28:30');
    await expect(warning).toBeVisible();
    await page.clock.fastForward('02:00');
    await expect(page).toHaveURL(/\/login\?reason=idle/);
    await expect(page.getByText('You were signed out after 30 minutes without activity.')).toBeVisible();
    // the session is really gone, not only the page
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('language', () => {
  test('Hebrew switches the page to right-to-left with Hebrew text; Arabic too; English again', async ({ page }) => {
    await loginUi(page, USERS.viewer);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await page.getByLabel('Language').selectOption('he');
    await expect(page.getByRole('heading', { level: 1, name: 'לוח בקרה' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    const sidebarBox = await page.locator('#sidebar').boundingBox();
    const viewport = page.viewportSize()!;
    expect(sidebarBox!.x).toBeGreaterThan(viewport.width / 2); // the menu moves to the right edge
    await page.goto('/orders');
    await expect(page.getByRole('heading', { level: 1, name: 'הזמנות' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

    await page.getByLabel('שפה').selectOption('ar');
    await expect(page.getByRole('heading', { level: 1, name: 'الطلبات' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.getByLabel('اللغة').selectOption('en');
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});
