import { expect, test, type Page } from '@playwright/test';
import { API, APP, expectNoAxeViolations, freshIp, noHorizontalScroll, stateFile, USERS } from './helpers';

// The fixes of the dashboard review (review 04) and the dashboard items of the accessibility review (review 03), end to
// end against the mock or the real API (harness). They change shared data, so they run on the desktop project (the
// read-only checks also on the phone).

test.use({ storageState: stateFile('owner') });
// Desktop only: the API allows 300 requests per admin per 15 minutes and the rest of the suite needs its share.
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop', 'run once (request budget)'));
const desktopOnly = (name: string) => test.skip(name !== 'desktop', 'state-changing flow: run once');

/** The order number of the first row of a list (the link text, "#xxxxxxxx"). */
async function firstOrderNumber(page: Page) {
  return ((await page.locator('tbody tr').first().getByRole('link').first().textContent()) ?? '').trim();
}

test.describe('orders (findings 5, 10, 11, 12, 30; review 03 finding 2)', () => {
  test.use({ storageState: stateFile('editor') });
  test('found by the number people quote, with or without "#"', async ({ page }) => {
    await page.goto('/orders');
    const number = await firstOrderNumber(page);
    expect(number).toMatch(/^#[0-9a-f]{8}$/);
    for (const q of [number, number.slice(1)]) {
      await page.getByRole('searchbox', { name: 'Search orders' }).fill(q);
      await page.getByRole('button', { name: 'Apply' }).click();
      await expect(page).toHaveURL(/q=/);
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expect(page.locator('tbody tr').first()).toContainText(number);
    }
  });

  test('an unverified payment is flagged in the list, and shipping it asks a stronger question', async ({ page }) => {
    await page.goto('/orders?status=unverified');
    const rows = page.locator('tbody tr');
    await expect(rows.first().getByTestId('order-unverified')).toHaveText('Payment not verified');
    const pending = rows.filter({ has: page.getByRole('button', { name: /Mark the order of/ }) }).first();
    if (await pending.count()) {
      await pending.getByRole('button', { name: /Mark the order of/ }).click();
      const dialog = page.getByRole('dialog', { name: 'PayPal did not confirm this payment' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'I checked PayPal: mark shipped' })).toHaveClass(/btn--danger/);
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
    }
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Payment not verified/ })).toHaveAttribute('href', '/orders?status=unverified');
  });

  test('Hebrew: the shipping address keeps "53 Pilgrim Road" in order (one isolated line per part)', async ({ page, context }) => {
    await context.addCookies([{ name: 'nhc_admin_lang', value: 'he', url: APP }]);
    await page.goto('/orders');
    await page.locator('tbody tr').first().getByRole('link').first().click();
    const lines = page.getByTestId('order-address').locator('.address__line');
    await expect(lines.first()).toHaveText(/^\d+ Pilgrim Road$/);
    // dir="auto" on a Latin line: it reads left to right inside the right-to-left page.
    expect(await lines.first().evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
    await expectNoAxeViolations(page);
  });

  test('closing the drawer gives the focus back to the link that opened it (review 03 finding 2)', async ({ page }) => {
    await page.goto('/orders');
    const link = page.locator('tbody tr').first().getByRole('link').first();
    await link.focus();
    await page.keyboard.press('Enter');
    const drawer = page.getByRole('dialog', { name: 'Order details' });
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('href') ?? document.activeElement?.tagName)).toMatch(/open=/);
    // ... and with the Close button, opened from its address (a shared link): the row's own link gets it
    const href = (await link.getAttribute('href')) ?? '';
    await page.goto(href);
    await page.getByRole('dialog', { name: 'Order details' }).getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('href') ?? document.activeElement?.tagName)).toMatch(/open=/);
  });

  test('mark shipped can be undone from the toast; a shipped order can be reopened in the drawer', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name);
    await page.goto('/orders?status=pending');
    const row = page.locator('tbody tr').filter({ hasNot: page.getByTestId('order-unverified') }).first();
    const number = await row.getByRole('link').first().textContent();
    await row.getByRole('button', { name: /Mark the order of .* as shipped/ }).click();
    await page.getByRole('dialog', { name: 'Mark as shipped?' }).getByRole('button', { name: 'Mark shipped' }).click();
    const toast = page.getByRole('status').filter({ hasText: 'Marked as shipped.' });
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Back to pending.' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: number ?? '' })).toHaveCount(1); // pending again

    await page.goto('/orders?status=shipped');
    await page.locator('tbody tr').first().getByRole('link').first().click();
    const drawer = page.getByRole('dialog', { name: 'Order details' });
    await drawer.getByTestId('order-unship').click();
    await page.getByRole('dialog', { name: 'Mark as not shipped?' }).getByRole('button', { name: 'Mark as not shipped' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Marked as not shipped.' })).toBeVisible();
  });

  test('the packing slip: address, items and quantities, no prices; prints without the menu', async ({ page, context }) => {
    await page.goto('/orders');
    await page.locator('tbody tr').first().getByRole('link').first().click();
    const [slip] = await Promise.all([context.waitForEvent('page'), page.getByTestId('order-slip').click()]);
    await slip.waitForLoadState();
    await expect(slip.getByRole('heading', { level: 1 })).toContainText(/Packing slip #[0-9a-f]{8}/);
    await expect(slip.getByTestId('packing-slip')).toContainText('Pilgrim Road');
    await expect(slip.getByRole('columnheader', { name: 'Quantity' })).toBeVisible();
    await expect(slip.getByTestId('packing-slip')).not.toContainText('$');
    await expectNoAxeViolations(slip);
    await slip.emulateMedia({ media: 'print' });
    await expect(slip.getByTestId('slip-print')).toBeHidden();
    await slip.close();
  });
});

test.describe('products (findings 2, 3, 4, 8, 21)', () => {
  test.use({ storageState: stateFile('editor') });

  test('"24,50" is 24.50, a thousands separator is refused, and the preview says so', async ({ page }) => {
    await page.goto('/products/new');
    const price = page.getByLabel(/^Price/);
    await price.fill('24,50');
    const preview = page.getByRole('complementary', { name: 'Preview' });
    await expect(preview.getByText('$24.50')).toBeVisible();
    await price.fill('1.234,50');
    await page.getByTestId('product-save').click();
    await expect(page.getByText('Write the price with digits and at most two decimals')).toBeVisible();
  });

  test('a photo on a host the website cannot show is refused, with the hosts named', async ({ page }) => {
    await page.goto('/products/new');
    await expect(page.getByText('Photo upload is not set up here (an owner can turn it on).')).toBeVisible();
    await page.getByLabel(/^Name/).fill('Review cross');
    await page.getByLabel(/^Price/).fill('12');
    await page.getByLabel(/^Main photo/).fill('https://upload.wikimedia.org/a.jpg');
    await expect(page.getByTestId('image-host-warning')).toContainText('upload.wikimedia.org');
    await page.getByTestId('product-save').click();
    await expect(page.getByText(/The website shows product photos only from firebasestorage\.googleapis\.com/)).toBeVisible();
    await expect(page).toHaveURL(/\/products\/new$/);
  });

  test('leaving a product form with unsaved changes asks first; staying keeps the text', async ({ page }, testInfo) => {
    await page.goto('/products/new');
    await page.getByLabel(/^Name/).fill('Half typed cross');
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Orders' }).click();
    const ask = page.getByRole('dialog', { name: 'Leave without saving?' });
    await expect(ask).toBeVisible();
    await ask.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/products\/new$/);
    await expect(page.getByLabel(/^Name/)).toHaveValue('Half typed cross');
    if (testInfo.project.name === 'mobile') await page.keyboard.press('Escape'); // the phone menu is still open
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('dialog', { name: 'Leave without saving?' }).getByRole('button', { name: 'Leave without saving' }).click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test('when the sign-in ended, saving leads to the sign-in page and back to the form with what was typed', async ({ browser }, testInfo) => {
    desktopOnly(testInfo.project.name);
    const context = await browser.newContext({ storageState: stateFile('editor') });
    const page = await context.newPage();
    await page.goto('/products/new');
    await page.getByLabel(/^Name/).fill('Typed before the sign-in ended');
    await page.getByLabel(/^Price/).fill('19,90');
    await page.getByLabel(/^Main photo/).fill(`${APP}/mock/candle.svg`);
    await context.clearCookies(); // the session is gone (as after 60 minutes)
    await page.getByTestId('product-save').click();
    await expect(page).toHaveURL(/\/login\?reason=expired&next=%2Fproducts%2Fnew/);
    await page.getByLabel('Username').fill(USERS.editor.username);
    await page.getByLabel('Password', { exact: true }).fill(USERS.editor.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/products\/new$/);
    await expect(page.getByTestId('draft-restored')).toBeVisible();
    await expect(page.getByLabel(/^Name/)).toHaveValue('Typed before the sign-in ended');
    await expect(page.getByLabel(/^Price/)).toHaveValue('19,90');
    await context.close();
  });

  test('saving says honestly when the website shows it', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name);
    await page.goto('/products/new');
    await page.getByLabel(/^Name/).fill(`Honest toast ${Date.now().toString(36)}`);
    await page.getByLabel(/^Price/).fill('8,50');
    await page.getByLabel(/^Main photo/).fill(`${APP}/mock/candle.svg`);
    await page.getByTestId('product-save').click();
    await expect(page.getByRole('status').filter({ hasText: 'Product created. The website shows it within 10 minutes.' })).toBeVisible();
  });
});

test.describe('users (findings 6, 7, 8)', () => {
  test('create a user with an e-mail; a click outside the dialog keeps what was typed', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name);
    const name = `rev-${Date.now().toString(36)}`;
    await page.goto('/users');
    await page.getByTestId('add-user').click();
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    await dialog.getByLabel('Username').fill(name);
    await page.mouse.click(5, 5); // outside the dialog
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Username')).toHaveValue(name);
    await dialog.getByLabel('E-mail (optional)').fill(`${name}@Example.com`);
    await dialog.getByLabel('Password', { exact: true }).fill(`${name}-Strong-Pass-1`);
    await dialog.getByRole('button', { name: 'Create user' }).click();
    await expect(page.getByRole('status').filter({ hasText: `User ${name} created.` })).toBeVisible();
    await page.goto(`/users?q=${name}`);
    await expect(page.locator('tbody tr')).toContainText(`${name}@example.com`);
  });

  test('a locked account says until when, and an owner unlocks it', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name);
    const name = `lock-${Date.now().toString(36)}`;
    await page.goto('/users');
    await page.getByTestId('add-user').click();
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    await dialog.getByLabel('Username').fill(name);
    await dialog.getByLabel('Password', { exact: true }).fill(`${name}-Strong-Pass-1`);
    await dialog.getByRole('button', { name: 'Create user' }).click();
    await expect(page.getByRole('status').filter({ hasText: `User ${name} created.` })).toBeVisible();
    // five wrong passwords, straight to the API
    for (let i = 0; i < 5; i += 1) {
      await fetch(`${API}/admin/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': freshIp() }, body: JSON.stringify({ username: name, password: 'wrong-wrong-wrong' }) });
    }
    await page.goto(`/users?q=${name}`);
    const row = page.locator('tbody tr').first();
    await expect(row.getByTestId('user-locked')).toHaveText(/^Locked until \d\d:\d\d$/);
    await row.getByTestId('user-unlock').click();
    await expect(page.getByRole('status').filter({ hasText: `${name} can sign in again.` })).toBeVisible();
    await expect(row.getByTestId('user-locked')).toHaveCount(0);
    await expect(row).toContainText('Active');
  });

  test('an account with two-factor offers "Reset two-factor" with a clear question', async ({ page }) => {
    await page.goto(`/users?q=${USERS.secure.username}`);
    const row = page.locator('tbody tr').filter({ hasText: USERS.secure.username }).first();
    await row.getByTestId('user-reset-totp').click();
    const ask = page.getByRole('dialog', { name: `Reset two-factor sign-in of ${USERS.secure.username}?` });
    await expect(ask).toContainText('For a lost phone.');
    await ask.getByRole('button', { name: 'Cancel' }).click(); // the shared account keeps its second factor
    await expect(ask).toBeHidden();
    await expectNoAxeViolations(page);
    await noHorizontalScroll(page);
  });
});

test.describe('audit log in words (finding 13)', () => {
  test('actions in words with their code, targets named and linked, a filter by kind', async ({ page }) => {
    await page.goto('/audit?action=auth.');
    await expect(page.locator('tbody tr').first()).toContainText(/Signed in|Sign-in refused|Signed out|Account locked/);
    await expect(page.getByLabel('Action')).toHaveValue('auth.');
    await page.goto('/audit?action=order.');
    const shipped = page.locator('tbody tr').filter({ hasText: 'Marked an order' }).first();
    if (await shipped.count()) await expect(shipped.getByRole('link', { name: /^Order #[0-9a-f]{8}$/ })).toHaveAttribute('href', /\/orders\?open=/);
    await expectNoAxeViolations(page);
  });
});
