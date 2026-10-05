import { expect, test } from '@playwright/test';
import { stateFile } from './helpers';

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

  test('can still read details and export', async ({ page }) => {
    await page.goto('/orders');
    await page.locator('tbody tr').first().getByRole('link', { name: 'View' }).click();
    const drawer = page.getByRole('dialog', { name: 'Order details' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: /Mark shipped|Delete/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    const csv = await page.request.get('/api/proxy/export/orders.csv');
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');
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
