import { expect, test } from '@playwright/test';

// The home hero uses the same licensed photograph at every viewport and in every language.
// A wide desktop must not start the former film or fetch any of its parts after hydration.
test('home hero is a photograph, without a video request on desktop or phone', async ({ browser }) => {
  for (const locale of ['en', 'he', 'ar']) {
    for (const width of [390, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage();
      const videoRequests: string[] = [];
      page.on('request', (request) => {
        if (/\/videos\//.test(request.url())) videoRequests.push(request.url());
      });
      await page.goto(`/${locale}`, { waitUntil: 'load' });
      const hero = page.locator('#home-hero');
      await expect(hero.locator('picture img')).toBeVisible();
      await expect(hero.locator('picture source[type="image/avif"]')).toHaveCount(1);
      await expect(hero.locator('video')).toHaveCount(0);
      await page.waitForTimeout(3500); // longer than the former video idle delay
      await expect(hero.locator('video')).toHaveCount(0);
      expect(videoRequests, `${locale} at ${width}px`).toEqual([]);
      await context.close();
    }
  }
});
