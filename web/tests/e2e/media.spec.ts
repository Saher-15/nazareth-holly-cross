import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { MEDIA, MEDIA_TOPICS, mediaByTopic } from '../../src/data/media';

// Licensed photos of Nazareth: /credits, /gallery, the credit line in the viewer and the AVIF/WebP files.

// These pages only read: nothing may leave the local server (the Commons links are only links).
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

const first = MEDIA[0];

test.describe('credits page', () => {
  test('lists every licensed photo with author, licence and a link to Wikimedia Commons', async ({ page }) => {
    await page.goto('/en/credits');
    await expect(page).toHaveTitle(/Photo credits/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Photo credits');

    const cards = page.locator('main li', { has: page.locator('picture') });
    await expect(cards).toHaveCount(MEDIA.length);

    const card = cards.first();
    await expect(card).toContainText(first.author);
    await expect(card.getByRole('link', { name: new RegExp(first.license) })).toHaveAttribute('href', first.licenseUrl);
    const source = card.getByRole('link', { name: /View on Wikimedia Commons/ });
    await expect(source).toHaveAttribute('href', first.sourceUrl);
    await expect(source).toHaveAttribute('target', '_blank');
    await expect(source).toHaveAttribute('rel', /noopener/);

    // every topic has a section and a jump link
    for (const topic of MEDIA_TOPICS) {
      await expect(page.locator(`#credits-${topic} li`)).toHaveCount(mediaByTopic(topic).length);
    }
  });

  test('describes each photo for search engines (ImageObject with credit and licence)', async ({ page }) => {
    await page.goto('/en/credits');
    type Block = { '@type': string; hasPart?: { '@type': string; creditText: string; license?: string }[] };
    const blocks = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(
      (text) => JSON.parse(text) as Block | Block[],
    );
    const collection = blocks.find((b) => b['@type'] === 'CollectionPage');
    expect(collection?.hasPart).toHaveLength(MEDIA.length);
    expect(collection?.hasPart?.[0]).toMatchObject({ '@type': 'ImageObject', creditText: first.credit });
    expect(blocks.some((b) => b['@type'] === 'BreadcrumbList')).toBe(true);
  });

  test('is linked from the footer on every page and is in the sitemap', async ({ page, request }) => {
    await page.goto('/en/about');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Photo credits' }).click();
    await expect(page).toHaveURL(/\/en\/credits$/);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/en/credits');
    expect(sitemap).toContain('/en/gallery');
  });

  test('is right-to-left and translated in Hebrew and Arabic', async ({ page }) => {
    await page.goto('/he/credits');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('קרדיט צילומים');
    await page.goto('/ar/credits');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('حقوق الصور');
  });

  test('has no serious accessibility violations', async ({ page }) => {
    await page.goto('/en/credits');
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe('gallery page', () => {
  test('groups the photos by topic, each group a gallery', async ({ page }) => {
    await page.goto('/en/gallery');
    await expect(page).toHaveTitle(/Photo gallery of Nazareth/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nazareth in photos');
    for (const topic of MEDIA_TOPICS) {
      await expect(page.locator(`#gallery-${topic} li`)).toHaveCount(mediaByTopic(topic).length);
    }
    await expect(page.locator('main picture')).toHaveCount(MEDIA.length + 1); // + the hero
  });

  test('the viewer names the photographer and the licence and links to the source', async ({ page }) => {
    await page.goto('/en/gallery');
    await page.locator('#gallery-basilica').getByRole('button').first().click();
    const viewer = page.getByRole('dialog');
    await expect(viewer).toBeVisible();
    const credit = viewer.getByText(/^Photo: /);
    await expect(credit).toContainText(`${first.author} · ${first.license}`);
    await expect(viewer.getByRole('link', { name: 'Source' })).toHaveAttribute('href', first.sourceUrl);
    // Tab stays inside the viewer, links included
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.querySelector('dialog')?.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
  });

  test('the credit follows the photo in Hebrew', async ({ page }) => {
    await page.goto('/he/gallery');
    await page.locator('#gallery-well').getByRole('button').first().click();
    await expect(page.getByRole('dialog').getByText(/^צילום: /)).toBeVisible();
  });

  test('has no serious accessibility violations, closed and open', async ({ page }) => {
    await page.goto('/en/gallery');
    expect(await seriousViolations(page)).toEqual([]);
    await page.locator('#gallery-well').getByRole('button').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe('licensed photos on the holy-site pages', () => {
  test('the hero is a licensed AVIF with a social card, and the old photos are still there', async ({ page }) => {
    await page.goto('/en/sites/latin');
    const hero = page.locator('header picture').first();
    await expect(hero.locator('source[type="image/avif"]')).toHaveAttribute('srcset', /basilica-facade\/640\.avif 640w/);
    await expect(hero.locator('source[type="image/webp"]')).toHaveAttribute('srcset', /basilica-facade\/1280\.webp 1280w/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /basilica-facade\/og\.jpg$/);
    await expect(page.locator('#place-gallery img[src*="/_next/image"]').first()).toBeAttached();
  });

  test('serves AVIF and WebP with long-lived caching', async ({ page, request }) => {
    const avif = await request.get(`/images/nazareth-media/${first.id}/${first.widths[0]}.avif`);
    expect(avif.status()).toBe(200);
    expect(avif.headers()['content-type']).toBe('image/avif');
    expect(avif.headers()['cache-control']).toMatch(/max-age=2592000/);
    const webp = await request.get(`/images/nazareth-media/${first.id}/${first.widths[0]}.webp`);
    expect(webp.headers()['content-type']).toBe('image/webp');
    await page.goto('/en/sites/latin');
  });

  test('a phone gets AVIF: sharp for the hero, small files for the gallery tiles', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phones only');
    const loaded: string[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/images/nazareth-media/')) loaded.push(r.url());
    });
    await page.goto('/en/sites/latin');
    await page.waitForLoadState('networkidle');
    await page.locator('#place-gallery').scrollIntoViewIfNeeded();
    await page.locator('#place-gallery li').nth(3).scrollIntoViewIfNeeded();
    // The lazy tiles start loading a frame after the scroll, which "networkidle" can miss: wait for a tile.
    await expect.poll(() => loaded.filter((u) => !u.includes('/basilica-facade/')).length).toBeGreaterThan(0);
    await page.waitForLoadState('networkidle');
    const hero = loaded.filter((u) => u.includes('/basilica-facade/'));
    expect(hero.length).toBeGreaterThan(0);
    expect(hero.every((u) => u.endsWith('.avif'))).toBe(true);
    // the hero is cropped sideways on a tall phone box, so it needs the big file to stay sharp
    expect(hero.some((u) => /\/(1920|2560)\.avif$/.test(u))).toBe(true);
    // gallery tiles are ~200px wide: nothing but the hero may download a 1920/2560px file
    const others = loaded.filter((u) => !u.includes('/basilica-facade/'));
    expect(others.length).toBeGreaterThan(0);
    expect(others.some((u) => /\/(1920|2560)\./.test(u))).toBe(false);
  });

  test('every holy-site page and the index have no serious accessibility violations', async ({ page }) => {
    for (const path of ['/en/sites', '/en/sites/city', '/en/sites/oldcity']) {
      await page.goto(path);
      expect(await seriousViolations(page), path).toEqual([]);
    }
  });
});
