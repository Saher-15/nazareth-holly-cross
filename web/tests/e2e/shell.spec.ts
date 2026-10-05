import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the bare domain sends visitors to a language', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('Hebrew and Arabic pages are right-to-left', async ({ page }) => {
  for (const locale of ['he', 'ar']) {
    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  }
  await page.goto('/fr');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('the language switcher keeps the visitor on the same page', async ({ page }) => {
  await page.goto('/en');
  await page.getByRole('button', { name: /language/i }).click();
  await page.getByRole('link', { name: 'Ελληνικά' }).click();
  await expect(page).toHaveURL(/\/el$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'el');
});

test('unknown pages show the localized 404', async ({ page }) => {
  const response = await page.goto('/en/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: /home/i }).last()).toBeVisible();
});

test('the mobile menu opens, and closes with Escape', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/en');
  const toggle = page.getByRole('button', { name: /open menu/i });
  await toggle.click();
  await expect(page.getByRole('button', { name: /close menu/i })).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false');
});

test('security headers are sent', async ({ request }) => {
  const res = await request.get('/en');
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['x-powered-by']).toBeUndefined();
});

test('home page has no serious accessibility violations', async ({ page }) => {
  await page.goto('/en');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
