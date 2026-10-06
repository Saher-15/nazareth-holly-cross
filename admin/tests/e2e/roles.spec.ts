import { expect, test } from '@playwright/test';
import { APP, stateFile } from './helpers';

// What each role sees. The API refuses the same things on its own (see security.spec.ts); the UI just does not offer them.

test.describe('viewer', () => {
  test.use({ storageState: stateFile('viewer') });

  test('has no users or audit entry in the menu and cannot open those pages', async ({ page, isMobile }) => {
    await page.goto('/');
    if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Audit log' })).toHaveCount(0);
    for (const path of ['/users', '/audit']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'You do not have access to this' }).first()).toBeVisible();
    }
  });

  test('sees no mutate buttons on orders, candles, contacts, prayers, reviews and products', async ({ page }) => {
    for (const path of ['/orders', '/candles', '/contacts', '/prayers', '/reviews', '/reviews?tab=product', '/products']) {
      await page.goto(path);
      await expect(page.locator('tbody tr').first()).toBeVisible();
      for (const name of [/Mark shipped/, /Mark as done/, /Delete/, /^Hide$/, /^Show$/, /Edit/]) {
        await expect(page.getByRole('button', { name })).toHaveCount(0);
      }
    }
    await page.goto('/products');
    await expect(page.getByRole('link', { name: 'Add product' })).toHaveCount(0);
    await page.goto('/products/new');
    await expect(page.getByRole('heading', { name: 'You do not have access to this' }).first()).toBeVisible();
  });

  test('can still read details', async ({ page }) => {
    await page.goto('/orders');
    await page.locator('tbody tr').first().getByRole('link', { name: 'View' }).click();
    const drawer = page.getByRole('dialog', { name: 'Order details' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: /Mark shipped|Delete/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('every forbidden call is refused by the API itself, not only hidden in the UI', async ({ page }) => {
    const origin = { Origin: APP };
    type Item = { _id?: string; id?: string; done?: boolean };
    const first = async (resource: string) => ((await (await page.request.get(`/api/proxy/${resource}?size=1`)).json()) as { items: Item[] }).items[0];
    const id = (x: Item) => (x._id ?? x.id) as string;
    const order = await first('orders');
    const candle = await first('candles');
    const product = await first('products');
    const attempts: [string, string, unknown?][] = [
      ['PATCH', `orders/${id(order)}`, { done: true }], ['DELETE', `orders/${id(order)}`], ['PATCH', `candles/${id(candle)}`, { done: true }], ['DELETE', `candles/${id(candle)}`],
      ['POST', 'products', { name: 'Nope', price: 5, img: 'https://example.com/a.jpg' }], ['PUT', `products/${id(product)}`, { price: 1 }], ['PATCH', `products/${id(product)}`, { price: 1 }],
      ['DELETE', `products/${id(product)}`], ['POST', 'users', { username: 'viewer-made', password: 'Viewer-Made-Pass-9', role: 'owner' }],
      ['GET', 'users'], ['GET', 'audit'], ['GET', 'export/orders.csv'],
    ];
    for (const [method, path, data] of attempts) {
      const res = await page.request.fetch(`/api/proxy/${path}`, { method, data, headers: origin });
      expect(res.status(), `${method} ${path}`).toBe(403);
    }
    // ...and nothing changed
    const again = (await (await page.request.get(`/api/proxy/orders/${id(order)}`)).json()) as Item;
    expect(again.done ?? false).toBe(order.done ?? false);
  });

  test('cannot export: no button, and the API refuses a bulk copy of personal data', async ({ page }) => {
    for (const path of ['/orders', '/candles', '/contacts']) {
      await page.goto(path);
      await expect(page.locator('tbody tr').first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Export CSV' })).toHaveCount(0);
    }
    for (const file of ['orders', 'candles', 'contacts']) {
      expect((await page.request.get(`/api/proxy/export/${file}.csv`)).status()).toBe(403);
    }
  });
});

test.describe('editor', () => {
  test.use({ storageState: stateFile('editor') });

  test('can change content but has no users or audit', async ({ page, isMobile }) => {
    await page.goto('/products');
    await expect(page.getByRole('link', { name: 'Add product' })).toBeVisible();
    if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'You do not have access to this' }).first()).toBeVisible();
  });

  test('can export the lists as CSV', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByRole('link', { name: 'Export CSV' })).toBeVisible();
    const csv = await page.request.get('/api/proxy/export/orders.csv');
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');
    expect(csv.headers()['content-disposition']).toMatch(/attachment; filename="orders-\d{4}-\d{2}-\d{2}\.csv"/);
  });

  test('cannot delete an order (owner only)', async ({ page }) => {
    await page.goto('/orders');
    await page.locator('tbody tr').first().getByRole('link', { name: 'View' }).click();
    const drawer = page.getByRole('dialog', { name: 'Order details' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  });
});

test.describe('owner', () => {
  test.use({ storageState: stateFile('owner') });

  test('sees everything in the menu and can delete orders', async ({ page, isMobile }) => {
    await page.goto('/orders');
    if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const name of ['Dashboard', 'Orders', 'Candle requests', 'Messages', 'Prayers', 'Reviews', 'Products', 'Users', 'Audit log', 'Security settings', 'Profile']) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    if (isMobile) await page.keyboard.press('Escape');
    await page.locator('tbody tr').first().getByRole('link', { name: 'View' }).click();
    await expect(page.getByRole('dialog', { name: 'Order details' }).getByRole('button', { name: 'Delete' })).toBeVisible();
  });
});
