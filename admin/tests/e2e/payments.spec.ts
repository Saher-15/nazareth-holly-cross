import { expect, test, type Browser } from '@playwright/test';
import { APP, expectNoAxeViolations, loginUi, noHorizontalScroll, stateFile, watchProblems } from './helpers';

// The Payments screen and the privacy tool, end to end. Both backends seed the same two payments that were paid but
// never saved (one order, one candle), a resolved one, donations and an abandoned checkout.
//
// The API gives each admin 300 requests per 15 minutes, and the suite shares one owner session between a lot of
// specs. So this file uses the EDITOR session (an editor may do everything on the Payments screen) and, for the
// owner-only privacy tool, an owner account of its own, created here.

test.describe('payments screen: every state renders (desktop and phone)', () => {
  test.use({ storageState: stateFile('editor') });

  for (const path of ['/payments', '/payments?status=unfulfilled', '/payments?status=resolved', '/payments?status=donation']) {
    test(`renders ${path}`, async ({ page }) => {
      const problems = watchProblems(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: 'Payments' })).toBeVisible();
      await expect(page.locator('tbody tr').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page);
      await expectNoAxeViolations(page);
      expect(problems).toEqual([]);
    });
  }

  test('the payment drawer renders without accessibility problems', async ({ page }) => {
    await page.goto('/payments?status=unfulfilled');
    await page.locator('tbody tr').first().getByRole('link', { name: 'View' }).click();
    await expect(page.getByRole('dialog', { name: 'Payment details' })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe('payments', () => {
  test.use({ storageState: stateFile('editor') });
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'state-changing flow: run once');
  });

  test('lists the ledger; "paid, not fulfilled" shows exactly the customers who paid and have nothing saved', async ({ page }) => {
    await page.goto('/payments');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    expect(await page.locator('tbody tr').count()).toBeGreaterThan(8);

    await page.goto('/payments?status=unfulfilled');
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'Paid, not fulfilled' })).toHaveCount(2);
    await expect(page.locator('tbody')).toContainText('lost.order@example.com');
    await expect(page.locator('tbody')).toContainText('Shop order');
    await expect(page.locator('tbody')).toContainText('Candle');
  });

  test('a banner above the list says how many are waiting, and links to them', async ({ page }) => {
    await page.goto('/payments');
    const banner = page.getByTestId('unfulfilled-alert');
    await expect(banner).toContainText('2 paid, not fulfilled');
    await banner.getByRole('link', { name: 'Show these payments' }).click();
    await expect(page).toHaveURL(/status=unfulfilled/);
    await expect(page.getByTestId('unfulfilled-alert')).toHaveCount(0); // the list already is that filter
  });

  test('the dashboard shows the alert and a figure for it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('unfulfilled-alert')).toContainText('2 paid, not fulfilled');
    await page.getByRole('region', { name: 'Key figures' }).getByRole('link', { name: /Paid, not fulfilled/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Payments' })).toBeVisible();
  });

  test('every other filter and the search work; donations and linked payments are not "unfulfilled"', async ({ page }) => {
    for (const [status, text] of [['donation', 'Donation'], ['candle', 'Candle'], ['created', 'Not paid'], ['failed', 'Failed'], ['resolved', 'Resolved']] as const) {
      await page.goto(`/payments?status=${status}`);
      await expect(page.locator('tbody tr').first()).toBeVisible();
      await expect(page.locator('tbody tr').first()).toContainText(text);
    }
    await page.goto('/payments?q=lost.candle');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.goto('/payments?q=zzzz-nobody');
    await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible();
  });

  test('a payment that is linked shows a link to its order', async ({ page }) => {
    await page.goto('/payments?status=order&sort=createdAt');
    const linked = page.locator('tbody tr').filter({ has: page.getByRole('link', { name: 'Open the order' }) }).first();
    await expect(linked).toBeVisible();
    await linked.getByRole('link', { name: 'Open the order' }).click();
    await expect(page.getByRole('dialog', { name: 'Order details' })).toBeVisible();
  });

  test('resolve with a note: the note is required, the payment leaves the alert, and it can be reopened', async ({ page }) => {
    await page.goto('/payments?status=unfulfilled');
    await page.locator('tbody tr').filter({ hasText: 'lost.candle@example.com' }).getByRole('link', { name: 'View' }).click();
    const drawer = page.getByRole('dialog', { name: 'Payment details' });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Nothing was saved for this payment');
    await drawer.getByTestId('resolve-payment').click();

    const dialog = page.getByRole('dialog', { name: 'Mark this payment as resolved' });
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('resolve-submit').click();
    await expect(dialog.getByText('Please write a note.')).toBeVisible(); // nothing was sent
    await dialog.getByLabel('Note').fill('Refunded in PayPal and the customer was told.');
    await dialog.getByTestId('resolve-submit').click();
    await expect(page.getByRole('status').filter({ hasText: 'Marked as resolved.' })).toBeVisible();

    await page.goto('/payments?status=unfulfilled');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByTestId('unfulfilled-alert')).toHaveCount(0);

    await page.goto('/payments?status=resolved&q=lost.candle');
    await page.locator('tbody tr').first().getByRole('link', { name: 'View' }).click();
    const resolved = page.getByRole('dialog', { name: 'Payment details' });
    await expect(resolved).toContainText('Refunded in PayPal and the customer was told.');
    await expect(resolved).toContainText('editor'); // who resolved it
    await resolved.getByRole('button', { name: 'Reopen' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Reopened.' })).toBeVisible();

    await page.goto('/payments?status=unfulfilled');
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });

  test('a viewer sees the ledger and the details, without the button to resolve or to export', async ({ browser }) => {
    const viewer = await browser.newContext({ storageState: stateFile('viewer') });
    const page = await viewer.newPage();
    await page.goto('/payments?status=unfulfilled');
    await page.locator('tbody tr').first().getByRole('link', { name: 'View' }).click();
    const drawer = page.getByRole('dialog', { name: 'Payment details' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId('resolve-payment')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Export CSV' })).toHaveCount(0);
    await viewer.close();
  });

  test('exports the ledger, and only the unfulfilled ones, as CSV', async ({ page }) => {
    await page.goto('/payments');
    await expect(page.getByRole('link', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Export not fulfilled' })).toBeVisible();
    const all = await page.request.get('/api/proxy/export/payments.csv');
    expect(all.status()).toBe(200);
    expect(all.headers()['content-disposition']).toMatch(/attachment; filename="payments-\d{4}-\d{2}-\d{2}\.csv"/);
    const unfulfilled = await page.request.get('/api/proxy/export/payments.csv?status=unfulfilled');
    const lines = (await unfulfilled.text()).trim().split('\r\n');
    expect(lines).toHaveLength(3); // header + the two customers who paid and have nothing saved
    expect(lines[0]).toContain('paypalOrderId');
  });

  test('there is no way to delete a payment from the screen or the proxy', async ({ page }) => {
    await page.goto('/payments');
    await expect(page.getByRole('button', { name: /Delete/ })).toHaveCount(0);
    const first = (await (await page.request.get('/api/proxy/payments?size=1')).json()) as { items: { _id?: string; id?: string }[] };
    const id = (first.items[0]._id ?? first.items[0].id) as string;
    const res = await page.request.fetch(`/api/proxy/payments/${id}`, { method: 'DELETE', headers: { Origin: APP } });
    expect(res.status()).toBe(404);
  });
});

const PRIVACY_OWNER = { username: 'privacy-owner', password: 'Privacy-Owner-Pass-1' };

// An owner of this file's own (see the comment at the top), signed in through the form.
async function asPrivacyOwner(browser: Browser) {
  const admin = await browser.newContext({ storageState: stateFile('owner') });
  const made = await admin.request.post('/api/proxy/users', { data: { ...PRIVACY_OWNER, role: 'owner' }, headers: { Origin: APP } });
  expect([201, 409]).toContain(made.status());
  await admin.close();
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginUi(page, PRIVACY_OWNER);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  return { page, context };
}

test.describe('privacy requests (owner)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'state-changing flow: run once');
  });

  test('renders without accessibility problems', async ({ browser }) => {
    const { page, context } = await asPrivacyOwner(browser);
    const problems = watchProblems(page);
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy requests' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page);
    expect(problems).toEqual([]);
    await context.close();
  });

  test('find what is stored about an address, erase it after typing it again, and it is gone', async ({ browser }) => {
    const { page, context } = await asPrivacyOwner(browser);
    await page.goto('/privacy');

    await page.getByTestId('privacy-email').fill('nobody-at-all@example.com');
    await page.getByTestId('privacy-find').click();
    await expect(page.getByText('Nothing is stored about this address.')).toBeVisible();
    await expect(page.getByTestId('privacy-erase')).toHaveCount(0);

    await page.getByTestId('privacy-email').fill('Lost.Order@Example.com');
    await page.getByTestId('privacy-find').click();
    await expect(page.getByTestId('privacy-result')).toBeVisible();
    await expect(page.getByTestId('privacy-count-payments')).toHaveText('1');
    await expect(page.getByTestId('privacy-count-orders')).toHaveText('0');

    await page.getByTestId('privacy-erase').click();
    const dialog = page.getByRole('dialog', { name: 'Erase everything stored about this address?' });
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('privacy-confirm').fill('someone-else@example.com');
    await dialog.getByTestId('privacy-confirm-submit').click();
    await expect(dialog.getByText('The two addresses do not match.')).toBeVisible(); // nothing was sent

    await dialog.getByTestId('privacy-confirm').fill('lost.order@example.com');
    await dialog.getByTestId('privacy-confirm-submit').click();
    await expect(page.getByRole('status').filter({ hasText: /Erased: 0 orders, 0 candle requests, 0 messages, 0 site reviews, 1 payments, 0 prayers, 0 product reviews/ })).toBeVisible();
    // the report: what was erased, and what this tool could not reach (to be done by hand)
    const report = page.getByTestId('privacy-report');
    await expect(report.getByTestId('privacy-erased-payments')).toHaveText('1');
    const notErased = report.getByTestId('privacy-not-erased');
    await expect(notErased.locator('li')).toHaveCount(7); // prayers and product reviews not searched (no name), then the five outside the database
    await expect(notErased).toContainText('Copies of the confirmation e-mails in the Gmail account');
    await expect(notErased).toContainText('Database backups keep the old data');
    await expect(notErased).toContainText('Broadcast recordings at Cloudflare');
    await expect(notErased).toContainText('Prayers were not searched');

    await page.getByTestId('privacy-email').fill('lost.order@example.com');
    await page.getByTestId('privacy-find').click();
    await expect(page.getByText('Nothing is stored about this address.')).toBeVisible();
    await context.close();
  });

  test('both the look-up and the erasure are in the audit log, and the address is not', async ({ browser }) => {
    const { page, context } = await asPrivacyOwner(browser);
    await page.goto('/audit?action=privacy.');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(page.locator('tbody')).toContainText('privacy.erase');
    await expect(page.locator('tbody')).toContainText('privacy.lookup');
    await expect(page.locator('main')).not.toContainText('lost.order@example.com');
    await context.close();
  });

  test('prayers and product reviews are searched only by the published name (and country), and say so', async ({ browser }) => {
    const { page, context } = await asPrivacyOwner(browser);
    await page.goto('/privacy');
    await page.getByTestId('privacy-email').fill('nobody-at-all@example.com');
    await page.getByTestId('privacy-country').fill('Italy');
    await page.getByTestId('privacy-find').click();
    await expect(page.getByText('A country is used only together with a name.')).toBeVisible(); // refused before sending

    await page.getByTestId('privacy-name').fill('Nobody Of That Name');
    await page.getByTestId('privacy-country').fill('');
    await page.getByTestId('privacy-find').click();
    const notes = page.getByTestId('privacy-not-searched');
    await expect(notes).toContainText('Prayers were not searched'); // a name alone is not enough for prayers
    await expect(notes).not.toContainText('Product reviews were not searched');

    await page.getByTestId('privacy-country').fill('Italy');
    await page.getByTestId('privacy-find').click();
    await expect(page.getByText('Nothing is stored about this address.')).toBeVisible();
    await expect(page.getByTestId('privacy-not-searched')).toHaveCount(0); // both were searched
    await context.close();
  });

  test('a malformed address is refused before anything is sent', async ({ browser }) => {
    const { page, context } = await asPrivacyOwner(browser);
    await page.goto('/privacy');
    await page.getByTestId('privacy-email').fill('not-an-address');
    await page.getByTestId('privacy-find').click();
    await expect(page.getByText('Enter a valid e-mail address.')).toBeVisible();
    await context.close();
  });
});
