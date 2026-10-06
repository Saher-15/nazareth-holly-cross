import { expect, test } from '@playwright/test';
import { APP, sentEmails, setMailFailure, stateFile } from './helpers';

// Working flows. They change the shared mock, so they run on the desktop project only (see playwright.config.ts).
test.use({ storageState: stateFile('owner') });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'state-changing flow: run once');
});

test.describe('orders', () => {
  test('mark shipped: confirm dialog, the customer is e-mailed, the status changes', async ({ page }) => {
    await page.goto('/orders?status=pending');
    const rows = page.locator('tbody tr');
    const pendingBefore = await rows.count();
    expect(pendingBefore).toBeGreaterThan(0);
    const row = rows.first();
    const customer = (await row.locator('td').nth(1).locator('span').first().textContent()) ?? '';

    await row.getByRole('button', { name: /Mark the order of .* as shipped/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Mark as shipped?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(customer);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(rows).toHaveCount(pendingBefore); // cancelled: nothing changed

    await row.getByRole('button', { name: /Mark the order of .* as shipped/ }).click();
    await page.getByRole('dialog', { name: 'Mark as shipped?' }).getByRole('button', { name: 'Mark shipped' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Marked as shipped. The customer was e-mailed.' })).toBeVisible();
    await expect(rows).toHaveCount(pendingBefore - 1);

    const emails = (await sentEmails()).filter((e) => /shipped/i.test(e.subject));
    expect(emails).toHaveLength(1); // once: marking it again would send nothing
  });

  test('when the mail cannot be sent the order is still shipped and the toast says to write to the customer', async ({ page }) => {
    await setMailFailure(true);
    try {
      await page.goto('/orders?status=pending');
      const rows = page.locator('tbody tr');
      const before = await rows.count();
      await rows.first().getByRole('button', { name: /Mark the order of .* as shipped/ }).click();
      await page.getByRole('dialog', { name: 'Mark as shipped?' }).getByRole('button', { name: 'Mark shipped' }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'could not be sent' })).toBeVisible();
      await expect(rows).toHaveCount(before - 1);
    } finally {
      await setMailFailure(false);
    }
  });

  test('text stored with entities shows as typed, and the payment filter finds unverified orders', async ({ page }) => {
    await page.goto('/orders?q=Jerry');
    await expect(page.locator('tbody')).toContainText('Tom & Jerry');
    await expect(page.locator('tbody')).not.toContainText('&amp;');
    await page.goto('/orders?status=unverified');
    await expect(page.locator('tbody tr')).toHaveCount(3);
  });

  test('detail drawer is a deep link, closes with Escape and keeps the list filters', async ({ page }) => {
    await page.goto('/orders?q=a&sort=totalPrice');
    const link = page.locator('tbody tr').first().getByRole('link', { name: 'View' });
    await link.click();
    await expect(page).toHaveURL(/open=/);
    const drawer = page.getByRole('dialog', { name: 'Order details' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Shipping address')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/q=a/);
    await expect(page).not.toHaveURL(/open=/);
    // reload a deep link directly
    await link.click();
    await expect(page).toHaveURL(/open=/);
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Order details' })).toBeVisible();
  });

  test('search, status filter and pagination', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByText(/Showing 1-25 of 42/)).toBeVisible();
    await page.getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Showing 26-42 of 42/)).toBeVisible();
    await page.goto('/orders');
    await page.getByRole('searchbox', { name: 'Search orders' }).fill('Nazareth');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/q=Nazareth/);
    for (const text of await page.locator('tbody tr').allTextContents()) expect(text).toContain('Nazareth');
    await page.getByRole('link', { name: 'Reset' }).click();
    await expect(page).not.toHaveURL(/q=/);
  });

  test('CSV export is a formula-safe CSV download', async ({ page }) => {
    await page.goto('/orders');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Export CSV' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = await page.request.get('/api/proxy/export/orders.csv').then((r) => r.text());
    expect(text.charCodeAt(0)).toBe(0xfeff); // byte-order mark: Excel reads Hebrew and Arabic names right
    const lines = text.slice(1).split('\r\n');
    expect(lines[0]).toBe('id,createdAt,firstName,lastName,email,phone,street,city,state,postal,country,totalPrice,done,paymentVerified,paypalOrderId,products');
    expect(text.length).toBeGreaterThan(1000);
    // Formula injection: no cell may START with = + - @ (the seed has a last name "-2+3" and a message "=HYPERLINK(...)").
    const cells = lines.flatMap((line) => line.split(','));
    expect(cells.filter((c) => /^["]?[=+\-@]/.test(c) && !/^-?\d+(\.\d+)?$/.test(c))).toEqual([]);
    expect(text).toContain("'-2+3");
    const contacts = await page.request.get('/api/proxy/export/contacts.csv').then((r) => r.text());
    expect(contacts).toContain("'@SUM");
    expect(contacts).not.toMatch(/(^|,)"?[=+\-@]/m);
  });

  test('owner can delete an order after confirming', async ({ page }) => {
    await page.goto('/orders?status=shipped');
    await page.locator('tbody tr').last().getByRole('link', { name: 'View' }).click();
    const drawer = page.getByRole('dialog', { name: 'Order details' });
    await drawer.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog', { name: 'Delete this order?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Order deleted.' })).toBeVisible();
    await expect(page).not.toHaveURL(/open=/);
  });
});

test.describe('inbox pages', () => {
  test('candle request: mark done, then delete', async ({ page }) => {
    await page.goto('/candles?status=pending');
    const rows = page.locator('tbody tr');
    const before = await rows.count();
    await rows.first().getByRole('button', { name: /Mark the request of .* as done/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Marked as done.' })).toBeVisible();
    await expect(rows).toHaveCount(before - 1);

    await page.goto('/candles');
    const total = await page.getByText(/Showing 1-25 of (\d+)/).textContent();
    await page.locator('tbody tr').first().getByRole('button', { name: /Delete the request of/ }).click();
    await page.getByRole('dialog', { name: 'Delete this request?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Request deleted.' })).toBeVisible();
    await expect(page.getByText(total ?? '')).toHaveCount(0);
  });

  test('contact message: read in the drawer, mark done', async ({ page }) => {
    await page.goto('/contacts?status=open');
    await page.locator('tbody tr').first().getByRole('link', { name: 'View' }).click();
    const drawer = page.getByRole('dialog', { name: 'Message' });
    await expect(drawer.getByRole('link', { name: 'Reply by e-mail' })).toBeVisible();
    await drawer.getByRole('button', { name: 'Mark as done' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Marked as done.' })).toBeVisible();
  });

  test('site review: hide and show again; product review tab', async ({ page }) => {
    await page.goto('/reviews?status=approved');
    const row = page.locator('tbody tr').first();
    await row.getByRole('button', { name: /^Hide the review of/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Review hidden.' })).toBeVisible();
    await page.goto('/reviews?status=hidden');
    await page.locator('tbody tr').first().getByRole('button', { name: /^Show the review of/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Review is visible again.' })).toBeVisible();
    await page.getByRole('link', { name: 'Product reviews' }).click();
    await expect(page.getByRole('link', { name: 'Product reviews' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('tbody tr').first().locator('.stars')).toBeVisible();
  });

  // docs/FORM-CONTRACTS.md 3.5: where the reviewer is from is searched and shown as a place, never as an e-mail address.
  test('site review: found and shown by place, old reviews (country in email) included', async ({ page }) => {
    await page.goto('/reviews?q=Trinidad');
    const row = page.locator('tbody tr').first();
    await expect(row.locator('.cell-sub[dir="auto"]')).toHaveText('Trinidad & Tobago');
    await page.goto('/reviews?q=Germany');
    const old = page.locator('tbody tr').first();
    await expect(old.locator('.cell-sub[dir="auto"]')).toHaveText('Germany');
    await expect(old.locator('.cell-sub bdi, .cell-sub [dir="ltr"]')).toHaveCount(0); // not shown as an address
  });

  test('prayer: delete asks first', async ({ page }) => {
    await page.goto('/prayers');
    const label = await page.getByText(/Showing 1-\d+ of \d+/).textContent();
    await page.locator('tbody tr').first().getByRole('button', { name: /Delete the prayer of/ }).click();
    await page.getByRole('dialog', { name: 'Delete this prayer?' }).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(label ?? '')).toBeVisible();
    await page.locator('tbody tr').first().getByRole('button', { name: /Delete the prayer of/ }).click();
    await page.getByRole('dialog', { name: 'Delete this prayer?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Prayer deleted.' })).toBeVisible();
  });
});

test.describe('products', () => {
  const name = `E2E Candle ${Date.now().toString(36)}`;

  test('validation errors are shown before anything is sent', async ({ page }) => {
    await page.goto('/products/new');
    await page.getByTestId('product-save').click();
    await expect(page.getByText('Enter a name of 2 to 200 characters.')).toBeVisible();
    await expect(page.getByText('Enter a price between 0.01 and 10,000.')).toBeVisible();
    await expect(page.getByText(/Add the main photo/)).toBeVisible();
    await expect(page.getByLabel(/^Name/)).toBeFocused();
    await expect(page).toHaveURL(/\/products\/new$/);
  });

  test('create, preview updates live, appears in the list', async ({ page }) => {
    await page.goto('/products/new');
    await page.getByLabel(/^Name/).fill(name);
    await page.getByLabel(/^Price/).fill('19.5');
    await page.getByLabel('Stock', { exact: true }).fill('3');
    await page.getByLabel('Category').selectOption('gifts');
    await page.getByLabel('Colours').fill('white, gold');
    await page.getByLabel('Description').fill('A test candle.');
    await page.getByLabel(/^Main photo/).fill('http://localhost:3901/mock/candle.svg');
    await page.getByRole('button', { name: 'Add another photo' }).click();
    await page.getByLabel('Extra photo 1').fill('http://localhost:3901/mock/star.svg');
    const preview = page.getByRole('complementary', { name: 'Preview' });
    await expect(preview.getByText(name)).toBeVisible();
    await expect(preview.getByText('$19.50')).toBeVisible();
    await expect(preview.getByText('3 in stock')).toBeVisible();
    await page.getByTestId('product-save').click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole('status').filter({ hasText: 'Product created.' })).toBeVisible();
    await page.goto(`/products?q=${encodeURIComponent(name)}`);
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });

  test('edit a product, then delete it', async ({ page }) => {
    await page.goto(`/products?q=${encodeURIComponent(name)}`);
    await page.locator('tbody tr').first().getByRole('link', { name }).click();
    await expect(page.getByLabel(/^Name/)).toHaveValue(name);
    await page.getByLabel(/^Price/).fill('22');
    await page.getByTestId('product-save').click();
    await expect(page).toHaveURL(/\/products$/);
    await page.goto(`/products?q=${encodeURIComponent(name)}`);
    await expect(page.locator('tbody tr').first()).toContainText('$22.00');

    await page.locator('tbody tr').first().getByRole('button', { name: `Delete ${name}` }).click();
    await page.getByRole('dialog', { name: 'Delete this product?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Product deleted.' })).toBeVisible();
    await expect(page.getByText('No matches')).toBeVisible();
  });

  test('grid view and the stock filter', async ({ page }) => {
    await page.goto('/products?view=grid&status=low');
    await expect(page.locator('.product-card').first()).toBeVisible();
    await page.goto('/products?status=out');
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });

  test('image upload falls back to pasting a URL when Firebase is not configured', async ({ page }) => {
    await page.goto('/products/new');
    await expect(page.getByText('Photo upload is not set up here.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload photo' })).toHaveCount(0);
  });
});

test.describe('users', () => {
  const username = `qa-${Date.now().toString(36)}`;

  test('create a user: policy is checked, then the user appears and can have a role', async ({ page }) => {
    await page.goto('/users');
    await page.getByTestId('add-user').click();
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    // A name the API refuses (it must start with a letter or digit) is caught here, in the admin's language.
    await dialog.getByLabel('Username').fill(`.${username}`);
    await dialog.getByLabel('Password', { exact: true }).fill(`${username}-Strong-Pass-1`);
    await dialog.getByRole('button', { name: 'Create user' }).click();
    await expect(dialog.getByRole('alert')).toContainText('starting with a letter or digit');
    await dialog.getByLabel('Username').fill(username);
    await dialog.getByLabel('Password', { exact: true }).fill('short');
    await dialog.getByRole('button', { name: 'Create user' }).click();
    await expect(dialog.getByRole('alert')).toContainText('at least 12 characters');
    await dialog.getByLabel('Password', { exact: true }).fill(`${username}-Strong-Pass-1`);
    await dialog.getByLabel('Role').selectOption('viewer');
    await dialog.getByRole('button', { name: 'Create user' }).click();
    await expect(page.getByRole('status').filter({ hasText: `User ${username} created.` })).toBeVisible();
    const row = page.locator('tbody tr', { hasText: username });
    await expect(row).toBeVisible();

    await row.getByLabel(`Role of ${username}`).selectOption('editor');
    await page.getByRole('dialog', { name: 'Change role?' }).getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('status').filter({ hasText: `${username} is now Editor.` })).toBeVisible();

    await row.getByRole('button', { name: `Disable ${username}` }).click();
    await page.getByRole('dialog', { name: 'Disable this user?' }).getByRole('button', { name: 'Disable' }).click();
    await expect(page.getByRole('status').filter({ hasText: `${username} disabled.` })).toBeVisible();
    await expect(row.getByText('Disabled').first()).toBeVisible();
  });

  test('your own row offers no role change, disable or delete', async ({ page }) => {
    await page.goto('/users?q=owner');
    const row = page.locator('tbody tr', { hasText: 'You' }).first();
    await expect(row.getByLabel(/^Role of owner/)).toBeDisabled();
    await expect(row.getByRole('button')).toHaveCount(0);
  });

  test('the API guards hold when called directly: not yourself, never the last owner', async ({ page }) => {
    const origin = { Origin: APP };
    const me = (await (await page.request.get('/api/proxy/auth/me')).json()) as { id: string };
    expect((await page.request.delete(`/api/proxy/users/${me.id}`, { headers: origin })).status()).toBe(400);
    expect((await page.request.patch(`/api/proxy/users/${me.id}`, { data: { role: 'viewer' }, headers: origin })).status()).toBe(400);
    expect((await page.request.patch(`/api/proxy/users/${me.id}`, { data: { disabled: true }, headers: origin })).status()).toBe(400);
    // an unknown field is refused (no mass assignment)
    expect((await page.request.patch(`/api/proxy/users/${me.id}`, { data: { role: 'owner', totpEnabled: true }, headers: origin })).status()).toBe(400);
  });

  test('the audit log records what was done, without passwords', async ({ page }) => {
    await page.goto('/audit?action=auth.login');
    await expect(page.locator('tbody tr').first()).toContainText('auth.login');
    await expect(page.locator('tbody')).toContainText(/Edge|Chrome/); // from which device (the browser sign-ins of the other tests)
    await page.goto('/audit?actor=owner&action=auth.login');
    await expect(page.locator('tbody tr').first()).toContainText('owner'); // who
    await page.goto('/audit');
    const text = (await page.locator('tbody').textContent()) ?? '';
    expect(text).toContain('auth.login');
    expect(text).not.toMatch(/Mock-Pass|Strong-Pass/);
    await page.goto('/audit?actor=nobody-with-this-name');
    await expect(page.getByText('No matches')).toBeVisible();
  });
});
