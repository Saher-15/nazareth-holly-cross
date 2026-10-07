import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import en from '../../src/messages/en.json';
import he from '../../src/messages/he.json';
import { nazarethDate, verseNumberFor } from '../../src/components/home/verse';

const API = 'https://nazareth-holy-cross-api-production.up.railway.app';
let apiWrites: string[] = [];

// The home page only reads data (on the server). Anything the browser tries to send
// to the production API is stopped here and fails the test.
test.beforeEach(async ({ page }) => {
  apiWrites = [];
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') return route.continue();
    apiWrites.push(`${request.method()} ${request.url()}`);
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  // The background film is not needed for these checks (hero-film.spec.ts covers it).
  await page.route(/\/videos\//, (route) => route.abort());
});

test.afterEach(() => {
  expect(apiWrites).toEqual([]);
});

const track = (page: Page) => page.locator('#home-sites-track');
const scrollLeft = (page: Page) => track(page).evaluate((el) => el.scrollLeft);

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

test('renders in English with its main paths, metadata and structured data', async ({ page }) => {
  await page.goto('/en');
  await expect(page).toHaveTitle(en.homePage.meta.title);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', en.homePage.meta.description);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.home.title);

  const hero = page.locator('#home-hero');
  await expect(hero.getByRole('link', { name: en.heroSection.lightCandle })).toHaveAttribute('href', '/en/candle');
  await expect(hero.getByRole('link', { name: en.heroSection.tourButton })).toHaveAttribute('href', '/en/tour');
  await expect(hero.getByRole('link', { name: en.heroSection.shopButton, exact: true })).toHaveAttribute('href', '/en/shop');

  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  const types = jsonLd['@graph'].map((node: { '@type': string }) => node['@type']);
  expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'WebPage']));
  expect(jsonLd['@graph'].find((n: { '@type': string }) => n['@type'] === 'WebPage').inLanguage).toBe('en');
});

test('renders right-to-left in Hebrew', async ({ page }) => {
  await page.goto('/he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page).toHaveTitle(he.homePage.meta.title);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(he.home.title);
  await expect(page.locator('#home-hero').getByRole('link', { name: he.heroSection.lightCandle })).toHaveAttribute(
    'href',
    '/he/candle',
  );
  await expect(page.getByRole('heading', { name: he.home.sitesTitle })).toBeVisible();
  await expect(track(page).getByRole('link').first()).toHaveAttribute('href', '/he/sites/latin');
});

test('a path that is not a language answers 404, not a server error', async ({ request }) => {
  const res = await request.get('/not-a-language.txt');
  expect(res.status()).toBe(404);
});

test('has no horizontal scroll from 360px to 1440px, in English and Hebrew', async ({ page, isMobile }) => {
  test.skip(isMobile, 'viewport sweep runs once, in the desktop project');
  test.setTimeout(90_000); // twelve page loads
  await page.emulateMedia({ reducedMotion: 'reduce' }); // sections in their final place
  for (const locale of ['en', 'he']) {
    for (const width of [360, 390, 768, 1024, 1366, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      // Layout does not wait for images (fixed-ratio boxes), so do not wait for them to be optimised.
      await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      // The shared site header is checked by its own tests; this measures the home page.
      // (Set through the CSSOM: the page's Content-Security-Policy refuses an injected <style> element.)
      await page.evaluate(() => document.querySelector<HTMLElement>('body > header')?.style.setProperty('display', 'none', 'important'));
      const result = await page.evaluate(() => {
        const sideways = '#home-sites-track, #home-voices [role="group"], #home-hero > :first-child';
        const outside = [...document.querySelectorAll('.ui-page *')]
          .filter((el) => !el.closest(sideways) && getComputedStyle(el).position !== 'fixed')
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
          })
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
        return { overflow: document.documentElement.scrollWidth - window.innerWidth, outside };
      });
      expect(result.overflow, `${locale} at ${width}px`).toBeLessThanOrEqual(0);
      expect(result.outside, `${locale} at ${width}px`).toEqual([]);
    }
  }
});

test('the holy-sites carousel links to every site and moves with the arrows and the keyboard', async ({ page }) => {
  await page.goto('/en');
  await page.locator('#home-sites').scrollIntoViewIfNeeded();

  const hrefs = await track(page).getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual([
    '/en/sites/latin',
    '/en/sites/greek',
    '/en/sites/maryswell',
    '/en/sites/oldcity',
    '/en/sites/city',
    '/en/tour',
  ]);

  const prev = page.getByRole('button', { name: en.home.prev });
  const next = page.getByRole('button', { name: en.home.next });
  await expect(prev).toHaveAttribute('aria-disabled', 'true');
  await next.click();
  await expect.poll(() => scrollLeft(page)).toBeGreaterThan(100);
  await expect(prev).toHaveAttribute('aria-disabled', 'false');

  await track(page).focus();
  await page.keyboard.press('End');
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Home');
  await expect.poll(() => scrollLeft(page)).toBeLessThanOrEqual(2);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => scrollLeft(page)).toBeGreaterThan(100);
});

test('in Hebrew the carousel moves towards the left', async ({ page }) => {
  await page.goto('/he');
  await page.locator('#home-sites').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: he.home.next }).click();
  await expect.poll(() => scrollLeft(page)).toBeLessThan(-100);
  await expect(page.getByRole('button', { name: he.home.prev })).toHaveAttribute('aria-disabled', 'false');
});

test('dragging the carousel with the mouse scrolls it without opening a card', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse drag is a desktop gesture; phones swipe natively');
  await page.goto('/en');
  await track(page).scrollIntoViewIfNeeded();
  const box = await track(page).boundingBox();
  if (!box) throw new Error('carousel not found');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.7, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => scrollLeft(page)).toBeGreaterThan(100);
  await expect(page).toHaveURL(/\/en$/);
});

test('the candle strip counts symbolic flames on this device', async ({ page }) => {
  await page.goto('/en');
  const strip = page.locator('#home-candle');
  await expect(strip.getByRole('link', { name: en.heroSection.lightCandle })).toHaveAttribute('href', '/en/candle');
  const status = strip.getByRole('status');
  await expect(status).toHaveText(en.home.flameCount.replace('{count}', '0'));
  const button = strip.getByRole('button', { name: en.home.flameBtn });
  await button.click();
  await button.click();
  await expect(status).toHaveText(en.home.flameCount.replace('{count}', '2'));
  await page.reload();
  await expect(page.locator('#home-candle').getByRole('status')).toHaveText(en.home.flameCount.replace('{count}', '2'));
});

test('the verse of the day follows the date in Nazareth', async ({ page }) => {
  await page.goto('/en');
  const card = page.locator('#home-verse figure');
  const isoDate = await card.locator('time').getAttribute('datetime');
  const n = await card.getAttribute('data-verse');
  // The page is regenerated in the background, so allow yesterday's verse just after midnight.
  const today = nazarethDate(new Date());
  const yesterday = nazarethDate(new Date(Date.now() - 86_400_000));
  expect([today, yesterday]).toContain(isoDate);
  expect(Number(n)).toBe(verseNumberFor(isoDate!));
  const messages = en.home as unknown as Record<string, string>;
  await expect(card.locator('blockquote')).toHaveText(messages[`v${n}`]);
  await expect(card.locator('figcaption')).toHaveText(messages[`r${n}`]);
});

test('featured souvenirs link to their shop pages, or explain that the shop is unreachable', async ({ page }) => {
  await page.goto('/en');
  const section = page.locator('#home-shop');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole('link', { name: en.home.shopAll })).toHaveAttribute('href', '/en/shop');
  if (await section.getByTestId('souvenirs-fallback').count()) {
    await expect(section.getByTestId('souvenirs-fallback')).toHaveText(en.home.shopError);
  } else {
    const hrefs = await section
      .getByRole('listitem')
      .getByRole('link')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.length).toBeLessThanOrEqual(8);
    for (const href of hrefs) expect(href).toMatch(/^\/en\/shop\/[\w-]+$/);
  }
});

test('pilgrim voices are shown only when there are reviews', async ({ page }) => {
  await page.goto('/en');
  const voices = page.locator('#home-voices');
  if (await voices.count()) {
    await expect(voices.getByRole('listitem').first()).toBeVisible();
    await expect(voices.getByRole('link', { name: en.home.voicesAll })).toHaveAttribute('href', '/en/reviews');
  } else {
    await expect(page.getByRole('heading', { name: en.home.voicesTitle })).toHaveCount(0);
  }
});

test('the sticky candle button appears once the hero has scrolled away', async ({ page }) => {
  await page.goto('/en');
  const sticky = page.locator('a[data-shown]');
  await expect(sticky).toBeHidden();
  await page.locator('#home-verse').scrollIntoViewIfNeeded();
  await expect(sticky).toBeVisible();
  await expect(sticky).toHaveAttribute('href', '/en/candle');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(sticky).toBeHidden();
});

test('sections reveal as they scroll into view', async ({ page }) => {
  await page.goto('/en');
  const story = page.locator('#home-story .ui-reveal');
  await expect(story).not.toHaveClass(/is-in/);
  await page.locator('#home-story').scrollIntoViewIfNeeded();
  await expect(story).toHaveClass(/is-in/);
});

test('the background film is left out on phones and under reduced motion (the film itself: hero-film.spec.ts)', async ({ page, isMobile }) => {
  const video = page.locator('#home-hero video');
  if (!isMobile) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(3500); // longer than the idle wait (at most 3 s after load) before the film would mount
  await expect(video).toHaveCount(0);
});

test('the sound button toggles the music', async ({ page }) => {
  await page.goto('/en');
  const sound = page.getByRole('button', { name: en.home.soundToggle });
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
});

test('keyboard users can reach the hero actions and the carousel', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard navigation is checked on desktop');
  await page.goto('/en');
  await page.locator('#home-hero').getByRole('link', { name: en.heroSection.lightCandle }).focus();
  await expect(page.locator('#home-hero').getByRole('link', { name: en.heroSection.lightCandle })).toBeFocused();
  await track(page).focus();
  await expect(track(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(track(page).getByRole('link').first()).toBeFocused();
});

for (const locale of ['en', 'he']) {
  test(`/${locale} has no serious accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // every section visible at once
    await page.goto(`/${locale}`);
    await expect(page.locator('#home-story .ui-reveal')).toHaveClass(/is-in/);
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test.describe('today in Nazareth, the map, the prayer wall and the social links', () => {
  test('the strip under the hero gives the time, the sun and the next feast in Nazareth', async ({ page }) => {
    await page.goto('/en');
    const today = page.getByRole('region', { name: en.home.today.title });
    await expect(today).toBeVisible();
    await expect(today.getByText(en.home.today.time)).toBeVisible();
    await expect(today.locator('time').first()).toHaveAttribute('datetime', /^\d{2}:\d{2}$/);
    await expect(today).toContainText(/Sunrise \d{1,2}:\d{2}/);
    await expect(today).toContainText(/Sunset \d{1,2}:\d{2}/);
    const feasts = Object.values(en.home.today.feasts);
    const feastText = await today.locator('[data-feast] dd').first().textContent();
    expect(feasts).toContain(feastText);
    // The broadcast is shown only with real data from the API (live now, or a scheduled one); otherwise it is absent.
    const broadcast = today.locator('[data-broadcast]');
    if (await broadcast.count()) await expect(broadcast.getByRole('link')).toHaveAttribute('href', '/en/live');
  });

  test('the strip reads right to left in Hebrew with Western digits', async ({ page }) => {
    await page.goto('/he');
    const today = page.getByRole('region', { name: he.home.today.title });
    await expect(today).toBeVisible();
    const text = (await today.textContent()) ?? '';
    expect(text).toMatch(/\d{2}:\d{2}/);
    expect(text).not.toMatch(/[٠-٩]/);
  });

  test('the map lists the five holy sites with walking times and leads to the planner', async ({ page }) => {
    await page.goto('/en');
    const map = page.locator('#home-map');
    await map.scrollIntoViewIfNeeded();
    const hrefs = await map.getByRole('listitem').getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(['/en/sites/latin', '/en/sites/greek', '/en/sites/maryswell', '/en/sites/oldcity', '/en/sites/city']);
    await expect(map.getByRole('link', { name: en.home.mapPlan })).toHaveAttribute('href', '/en/plan');
    await expect(map.locator('svg[viewBox="0 0 400 300"]')).toHaveAttribute('aria-hidden', 'true');
  });

  test('the prayer wall shows real figures and the newest prayers, or nothing at all', async ({ page }) => {
    await page.goto('/en');
    const section = page.locator('#home-prayers');
    if (!(await section.count())) return; // the API could not be read: the section is left out, never filled in
    await section.scrollIntoViewIfNeeded();
    const total = Number((await section.getByTestId('prayers-total').textContent())?.replace(/[^\d]/g, ''));
    expect(total).toBeGreaterThan(0);
    const cards = section.getByRole('listitem');
    expect(await cards.count()).toBeGreaterThan(0);
    expect(await cards.count()).toBeLessThanOrEqual(3);
    await expect(section.getByRole('link', { name: en.home.prayersAll })).toHaveAttribute('href', '/en/prayers');
  });

  test('the social links open the three profiles in a new tab, safely', async ({ page }) => {
    await page.goto('/en');
    const links = page.locator('#home-follow').getByRole('link');
    await expect(links).toHaveCount(3);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(link).toHaveAttribute('aria-label', /\(opens in a new tab\)/);
    }
  });
});
