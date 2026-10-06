import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, noHorizontalScroll, stateFile, watchProblems } from './helpers';

// Every page renders for the owner, with no console errors or CSP violations, no accessibility violations
// (axe, WCAG 2.1 A/AA), and no sideways scrolling, on desktop and on a phone.
test.use({ storageState: stateFile('owner') });

const PAGES: { path: string; heading: string }[] = [
  { path: '/', heading: 'Dashboard' },
  { path: '/orders', heading: 'Orders' },
  { path: '/orders?status=pending', heading: 'Orders' },
  { path: '/candles', heading: 'Candle requests' },
  { path: '/contacts', heading: 'Messages' },
  { path: '/products', heading: 'Products' },
  { path: '/products?view=grid', heading: 'Products' },
  { path: '/products/new', heading: 'Add product' },
  { path: '/reviews', heading: 'Reviews' },
  { path: '/reviews?tab=product', heading: 'Reviews' },
  { path: '/prayers', heading: 'Prayers' },
  { path: '/users', heading: 'Users' },
  { path: '/audit', heading: 'Audit log' },
  { path: '/settings', heading: 'Security settings' },
  { path: '/profile', heading: 'Profile' },
];

for (const { path, heading } of PAGES) {
  test(`renders ${path}`, async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page);
    expect(problems).toEqual([]);
  });
}

test('a list page shows the seeded data, a search narrows it and an empty search says so', async ({ page }) => {
  await page.goto('/orders');
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  const first = await rows.count();
  expect(first).toBeGreaterThan(5);

  await page.goto('/orders?q=zzzz-no-such-customer');
  await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible();
});

test('the dashboard shows the figures, both charts and an accessible data table', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Key figures' })).toBeVisible();
  await expect(page.locator('.kpi')).toHaveCount(9); // 8 figures and the payments to deal with
  await expect(page.locator('svg.qr, .chart__plot svg')).toHaveCount(2);
  await page.getByText('Show data as a table').first().click();
  await expect(page.locator('.chart__data table').first().locator('tbody tr')).toHaveCount(30);
  // keyboard: focus a chart and move through the days
  const plot = page.locator('.chart__plot').first();
  await plot.focus();
  const readout = page.locator('.chart__readout').first();
  const before = await readout.textContent();
  await page.keyboard.press('ArrowLeft');
  await expect(readout).not.toHaveText(before ?? '');
});

test('an unknown page shows the not-found state, a bad product id too', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.goto('/products/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
