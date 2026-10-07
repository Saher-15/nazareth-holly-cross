import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Holy sites (/sites, /sites/<slug>), the virtual tour and the about page.

const PLACES = [
  { slug: 'latin', en: 'Basilica of the Annunciation', he: 'בזיליקת הבשורה', photos: 42 },
  { slug: 'greek', en: 'Greek Orthodox Church', he: 'הכנסייה היוונית־אורתודוקסית', photos: 24 },
  { slug: 'maryswell', en: "Mary's Well", he: 'מעיין מרים', photos: 10 },
  { slug: 'oldcity', en: 'The Old City', he: 'העיר העתיקה', photos: 24 },
  { slug: 'city', en: 'The City of Nazareth', he: 'העיר נצרת', photos: 20 },
];

const PAGES = ['/sites', '/sites/latin', '/sites/maryswell', '/tour', '/about'];

// These pages only read: nothing may leave the local server (no maps, no video, no API).
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

async function jsonLdTypes(page: Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((text) => {
    const data = JSON.parse(text) as { '@type': string | string[] } | { '@type': string | string[] }[];
    return (Array.isArray(data) ? data : [data]).flatMap((item) => item['@type']);
  });
}

test.describe('holy sites index', () => {
  test('lists the five places as cards linking to their pages', async ({ page }) => {
    await page.goto('/en/sites');
    await expect(page).toHaveTitle(/Holy sites of Nazareth/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The holy sites of Nazareth');
    const cards = page.getByRole('article');
    await expect(cards).toHaveCount(5);
    for (const place of PLACES) {
      await expect(page.getByRole('link', { name: place.en, exact: true })).toHaveAttribute(
        'href',
        `/en/sites/${place.slug}`,
      );
    }
    await expect(cards.first()).toContainText('42 photos');
    expect(await jsonLdTypes(page)).toEqual(expect.arrayContaining(['ItemList', 'BreadcrumbList']));
  });

  test('a card opens its place', async ({ page }) => {
    await page.goto('/en/sites');
    await page.getByRole('article').nth(2).click({ position: { x: 40, y: 40 } });
    await expect(page).toHaveURL(/\/en\/sites\/maryswell$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Mary's Well");
  });

  test('is right-to-left and translated in Hebrew', async ({ page }) => {
    await page.goto('/he/sites');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('המקומות הקדושים בנצרת');
    await expect(page.getByRole('link', { name: 'מעיין מרים', exact: true })).toHaveAttribute(
      'href',
      '/he/sites/maryswell',
    );
  });
});

test.describe('place pages', () => {
  for (const place of PLACES) {
    test(`${place.slug}: story, visit card, gallery and other places`, async ({ page }) => {
      await page.goto(`/en/sites/${place.slug}`);
      await expect(page).toHaveTitle(new RegExp(place.en));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(place.en);
      await expect(page.getByRole('complementary', { name: 'Plan your visit' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Light a candle/ }).first()).toHaveAttribute('href', '/en/candle');
      await expect(page.locator('#place-gallery li')).toHaveCount(place.photos);
      await expect(page.locator('#place-gallery')).toContainText(`${place.photos} photos`);
      // Four other places plus the tour, never the current one.
      const more = page.locator('section[aria-labelledby="place-more-title"] li a');
      await expect(more).toHaveCount(5);
      await expect(more.filter({ hasText: place.en })).toHaveCount(0);
      expect(await jsonLdTypes(page)).toEqual(expect.arrayContaining(['TouristAttraction', 'BreadcrumbList']));
    });
  }

  test('map links open Google Maps in a new tab and say so', async ({ page }) => {
    await page.goto('/en/sites/greek');
    const map = page.getByRole('link', { name: 'View on Google Maps (opens in a new tab)' }).first();
    await expect(map).toHaveAttribute('target', '_blank');
    await expect(map).toHaveAttribute('rel', /noopener/);
    await expect(map).toHaveAttribute('href', /google\.com\/maps/);
  });

  test('every language version is announced', async ({ page }) => {
    await page.goto('/en/sites/latin');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/sites\/latin$/);
    await expect(page.locator('link[rel="alternate"][hreflang="he"]')).toHaveAttribute('href', /\/he\/sites\/latin$/);
  });

  test('renders in Hebrew, right-to-left', async ({ page }) => {
    for (const place of PLACES) {
      await page.goto(`/he/sites/${place.slug}`);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(place.he);
    }
  });

  test('"View the photos" jumps to the gallery', async ({ page }) => {
    await page.goto('/en/sites/oldcity');
    await page.getByRole('link', { name: /View the photos/ }).click();
    await expect(page).toHaveURL(/#place-gallery$/);
    await expect(page.getByRole('heading', { name: 'Photo gallery' })).toBeInViewport();
  });

  test('an unknown place is a 404', async ({ page }) => {
    const response = await page.goto('/en/sites/nowhere');
    expect(response?.status()).toBe(404);
  });
});

test.describe('photo viewer', () => {
  test('opens on a photo, steps with the arrow keys, keeps focus inside and closes with Escape', async ({ page }) => {
    await page.goto('/en/sites/maryswell');
    const thumb = page.getByRole('button', { name: "Mary's Well: the well, photo 1 of 10" });
    await thumb.click();

    const viewer = page.getByRole('dialog', { name: "Photos of Mary's Well" });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Close' })).toBeFocused();
    await expect(viewer.getByRole('img', { name: "Mary's Well: the well, photo 1 of 10" })).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(viewer.getByRole('img', { name: "Mary's Well: the well, photo 2 of 10" })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(viewer.getByRole('img', { name: "Mary's Well, photo 10 of 10" })).toBeVisible();

    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.querySelector('dialog')?.contains(document.activeElement))).toBe(true);
    }

    await viewer.getByRole('button', { name: 'Next' }).click();
    await expect(viewer.getByRole('img', { name: "Mary's Well: the well, photo 1 of 10" })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(thumb).toBeFocused();
  });

  test('has no serious accessibility violations while open', async ({ page }) => {
    await page.goto('/en/sites/greek');
    await page.getByRole('button', { name: 'Greek Orthodox Church of the Annunciation: interior, photo 3 of 24' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('mirrors the arrow keys in Hebrew', async ({ page }) => {
    await page.goto('/he/sites/maryswell');
    await page.getByRole('button', { name: 'מעיין מרים: המעיין, תמונה 1 מתוך 10' }).click();
    const viewer = page.getByRole('dialog', { name: 'תמונות של מעיין מרים' });
    await expect(viewer).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(viewer.getByRole('img', { name: 'מעיין מרים: המעיין, תמונה 2 מתוך 10' })).toBeVisible();
    await viewer.getByRole('button', { name: 'סגירה' }).click();
    await expect(viewer).toBeHidden();
  });

  test('a sideways swipe changes the photo', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch screens only');
    await page.goto('/en/sites/maryswell');
    await page.getByRole('button', { name: "Mary's Well: the well, photo 1 of 10" }).click();
    const viewer = page.getByRole('dialog');
    await expect(viewer).toBeVisible();
    await page.evaluate(() => {
      const el = document.querySelector('dialog')!;
      const at = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [at(320)], changedTouches: [at(320)] }));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [at(120)] }));
    });
    await expect(viewer.getByRole('img', { name: "Mary's Well: the well, photo 2 of 10" })).toBeVisible();
  });
});

test.describe('virtual tour', () => {
  test('the video downloads nothing until played and the places follow', async ({ page }) => {
    await page.goto('/en/tour');
    await expect(page).toHaveTitle(/Virtual tour of Nazareth/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Explore Nazareth');
    const video = page.locator('video');
    await expect(video).toHaveAttribute('preload', 'none');
    await expect(video).toHaveAttribute('poster', /\/images\/nazareth-media\/old-city-arched-passage\/1280\.webp$/);
    await expect(video.locator('source').first()).toHaveAttribute('type', 'video/mp4');
    await expect(page.getByRole('link', { name: 'Learn more about Nazareth' })).toHaveAttribute(
      'href',
      '/en/sites/city',
    );
    await expect(page.locator('section[aria-labelledby="tour-places-title"] li a')).toHaveCount(5);
  });

  test('renders in Hebrew', async ({ page }) => {
    await page.goto('/he/tour');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('גלו את נצרת');
  });
});

test.describe('about', () => {
  test('shows the welcome and the three ways to connect', async ({ page }) => {
    await page.goto('/en/about');
    await expect(page).toHaveTitle(/About us/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to Nazareth Holy Cross');
    const main = page.locator('main');
    await expect(main.getByRole('heading', { level: 2 })).toHaveText([
      'A pilgrimage from afar',
      'Treasures from the Holy Land',
      'Supporting our community',
    ]);
    await expect(main.getByRole('link', { name: /Nazareth tour/i })).toHaveAttribute('href', '/en/tour');
    await expect(main.getByRole('link', { name: /Visit the shop/i })).toHaveAttribute('href', '/en/shop');
    await expect(main.getByRole('link', { name: /Light a candle/i })).toHaveAttribute('href', '/en/candle');
  });

  test('renders in Hebrew', async ({ page }) => {
    await page.goto('/he/about');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ברוכים הבאים לפורטל הרשמי של נצרת');
  });
});

test.describe('quality', () => {
  for (const locale of ['en', 'he']) {
    for (const path of PAGES) {
      test(`${locale}${path} has no serious accessibility violations`, async ({ page }) => {
        await page.goto(`/${locale}${path}`);
        expect(await seriousViolations(page)).toEqual([]);
      });
    }
  }

  test('nothing sticks out sideways from 360px to 1440px', async ({ page, isMobile }) => {
    test.skip(isMobile, 'viewport sweep runs once, on desktop');
    test.setTimeout(180_000); // 4 widths x 2 languages x every page
    for (const width of [360, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const locale of ['en', 'he']) {
        for (const path of PAGES) {
          await page.goto(`/${locale}${path}`);
          // Page content: no element past either edge, unless a box inside the page clips it on purpose.
          const outside = await page.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            const clippedInside = (el: Element) => {
              for (let a = el.parentElement; a && !a.classList.contains('ui-page'); a = a.parentElement) {
                if (['hidden', 'clip'].includes(getComputedStyle(a).overflowX)) return true;
              }
              return false;
            };
            return [...document.querySelectorAll('main .ui-page *')]
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && (r.right > vw + 1 || r.left < -1) && !clippedInside(el);
              })
              .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
          });
          expect(outside, `${width}px /${locale}${path}`).toEqual([]);
          // The whole document, header included.
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow, `${width}px /${locale}${path}`).toBeLessThanOrEqual(0);
        }
      }
    }
  });
});
