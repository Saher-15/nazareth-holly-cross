import { expect, test } from '@playwright/test';
import en from '../../src/messages/en.json';

// The opening door (docs/DESIGN-GUIDE.md 1.5, web/src/lib/intro.ts). Automation never sees it, so these tests turn it
// on by hiding navigator.webdriver before the page's own scripts run.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  await page.route(/\/videos\//, (route) => route.abort());
});

const door = (page: import('@playwright/test').Page) => page.getByTestId('opening-door');

// The opening lasts under 4 s, so the tests start at the first byte instead of waiting for the whole page to load.
const openHome = (page: import('@playwright/test').Page, path = '/en') => page.goto(path, { waitUntil: 'commit' });

test('opens once when a visit starts on the home page, then never again in that tab', async ({ page }) => {
  await openHome(page);
  await expect(door(page)).toBeVisible();
  await expect(door(page)).toContainText(en.home.intro.welcome);
  await expect(door(page)).toBeHidden({ timeout: 8000 });
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);

  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);
  await expect(door(page)).toBeHidden();
});

test('any key skips it, even before the page has hydrated', async ({ page }) => {
  await openHome(page);
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'door');
  // Pressed and read in one step, so the natural end of the opening cannot come in between.
  const after = await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return document.documentElement.getAttribute('data-intro');
  });
  expect(after).toBe('skip');
  await expect(door(page)).toBeHidden({ timeout: 2000 });
});

test('a visit that starts on another page never shows it', async ({ page }) => {
  await page.goto('/en/tour');
  await page.goto('/en');
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);
  await expect(door(page)).toBeHidden();
});

test('never for reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const page = await context.newPage();
  await page.goto('/he');
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);
  await expect(door(page)).toBeHidden();
  await context.close();
});
