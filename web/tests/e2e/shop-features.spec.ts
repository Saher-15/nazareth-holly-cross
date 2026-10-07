import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import en from '../../src/messages/en.json';

// Storefront features: filters, best-seller strip, cards, wishlist, reviews, similar and
// recently viewed, share. Pages are rendered on the server from the live API (read-only).
// The browser never writes to the API: the automatic guard below fails any attempt, and
// the review form is tested against mocked answers (page.route) only.

const API = /nazareth-holy-cross-api-production\.up\.railway\.app/;
const API_URL = 'https://nazareth-holy-cross-api-production.up.railway.app';

const test = base.extend<{ apiGuard: string[] }>({
  apiGuard: [
    async ({ page }, use) => {
      const writes: string[] = [];
      await page.route(API, (route) => {
        const request = route.request();
        if (request.method() === 'GET' || request.method() === 'HEAD') return route.continue();
        writes.push(`${request.method()} ${request.url()}`);
        return route.abort('blockedbyclient');
      });
      await use(writes);
      expect(writes, 'the shop pages must never write to the real API').toEqual([]);
    },
    { auto: true },
  ],
});

type CatalogProduct = { _id: string; name: string; sold: number; rating: { count: number }; category: string };

/**
 * The live catalogue (read-only), or null when the API refuses (it allows 200 requests per
 * 15 minutes per IP, shared with every other process on this machine). Tests that use it
 * then check what the page shows for consistency instead.
 */
async function liveCatalog(request: APIRequestContext): Promise<CatalogProduct[] | null> {
  const res = await request.get(`${API_URL}/product/catalog`);
  return res.ok() ? ((await res.json()) as { products: CatalogProduct[] }).products : null;
}

/** Clicks the n-th star of the review form like a visitor would, until the choice sticks. */
async function pickStars(form: Locator, n: number) {
  const name = n === 1 ? '1 star' : `${n} stars`;
  const radio = form.getByRole('radio', { name });
  const star = form.locator('label').filter({ hasText: new RegExp(`\\b${name}$`) });
  await expect(async () => {
    await star.click();
    await expect(radio).toBeChecked({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

const CATEGORY_LABELS = Object.values(en.shopFeatures.categories);

const inMain = (page: Page) => page.getByRole('main');
const grid = (page: Page) => inMain(page).getByTestId('shop-grid');
const cards = (page: Page) => grid(page).getByTestId('product-card');
const count = (page: Page) => inMain(page).getByTestId('shop-count');
const chips = (page: Page) => inMain(page).getByTestId('filter-chip');

/** Waits until React has hydrated an element, so clicks reach their handlers. */
async function hydrated(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith('__reactProps'))), { timeout: 15_000 })
    .toBe(true);
}

async function openShop(page: Page, path = '/en/shop') {
  await page.goto(path);
  await expect(cards(page).first()).toBeVisible();
  await hydrated(inMain(page).locator('#shop-sort'));
}

async function firstProductHref(page: Page, locale = 'en') {
  await page.goto(`/${locale}/shop`);
  return (await cards(page).first().getAttribute('href'))!;
}

async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const totalOf = async (page: Page) => Number((await count(page).textContent())!.match(/of (\d+)/)![1]);

test.describe('shop filters', () => {
  test.describe.configure({ timeout: 90_000 });
  test('filter from the sidebar: category, material, chips, clear all and Back', async ({ page, isMobile }) => {
    test.skip(isMobile, 'phones use the filter drawer');
    await openShop(page);
    const all = await totalOf(page);
    const sidebar = inMain(page).getByRole('complementary', { name: 'Filters' });

    await sidebar.getByRole('radio', { name: /^Rosaries\s*\d+$/ }).check();
    await expect(page).toHaveURL(/[?&]category=rosaries/);
    const rosaries = await totalOf(page);
    expect(rosaries).toBeLessThan(all);
    for (const text of await cards(page).allTextContents()) expect(text).toContain('Rosaries');
    await expect(cards(page)).toHaveCount(Math.min(rosaries, 12));

    await sidebar.getByRole('checkbox', { name: /^Wood\s*\d+$/ }).check();
    await expect(page).toHaveURL(/material=wood/);
    await expect(chips(page)).toHaveText(['Rosaries', 'Wood']);
    await expect(inMain(page).getByTestId('product-strip')).toHaveCount(0); // no strip while filtering
    const both = await totalOf(page);
    expect(both).toBeLessThanOrEqual(rosaries);

    // Back undoes the last filter.
    await page.goBack();
    await expect(page).not.toHaveURL(/material=/);
    await expect(chips(page)).toHaveText(['Rosaries']);
    await page.goForward();
    await expect(chips(page)).toHaveText(['Rosaries', 'Wood']);

    // Removing a chip keeps the keyboard on the chips.
    await page.getByRole('button', { name: 'Remove filter: Rosaries' }).click();
    await expect(chips(page)).toHaveText(['Wood']);
    await expect(page.getByRole('button', { name: 'Remove filter: Wood' })).toBeFocused();

    await inMain(page).getByRole('button', { name: 'Clear all' }).first().click();
    await expect(chips(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/en\/shop$/);
    await expect(count(page)).toHaveText(new RegExp(`of ${all}$`));
  });

  test('price, rating and stock filters', async ({ page, isMobile }) => {
    test.skip(isMobile, 'phones use the filter drawer');
    await openShop(page);
    const sidebar = inMain(page).getByRole('complementary', { name: 'Filters' });

    await sidebar.getByLabel('Max').fill('20');
    await sidebar.getByLabel('Max').press('Enter');
    await expect(page).toHaveURL(/max=20/);
    await expect(chips(page)).toHaveText(['Up to $20.00']);
    const prices = await cards(page).locator('[data-price]').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-price'))));
    expect(prices.every((p) => p <= 20)).toBe(true);

    await sidebar.getByRole('checkbox', { name: /^In stock only\s*\d+$/ }).check();
    await expect(page).toHaveURL(/stock=1/);
    await sidebar.getByRole('radio', { name: /^4 stars & up\s*\d+$/ }).check();
    await expect(page).toHaveURL(/rating=4/);
    await expect(chips(page)).toHaveText(['Up to $20.00', '4 stars & up', 'In stock only']);
  });

  test('filters come from the URL, with the sort order', async ({ page }) => {
    await openShop(page, '/en/shop?category=stained-glass&max=55&sort=priceDesc');
    await expect(chips(page)).toHaveText(['Stained glass', 'Up to $55.00']);
    await expect(page.getByLabel('Sort by')).toHaveValue('priceDesc');
    const prices = await cards(page).locator('[data-price]').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-price'))));
    expect(prices.length).toBeGreaterThan(0);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
    expect(prices.every((p) => p <= 55)).toBe(true);
    await expect(inMain(page).getByTestId('product-strip')).toHaveCount(0);

    // Unknown values are ignored instead of breaking the page.
    await openShop(page, '/en/shop?category=spaceships&rating=9&sort=random');
    await expect(chips(page)).toHaveCount(0);
    await expect(page.getByLabel('Sort by')).toHaveValue('featured');
  });

  test('every sort order is offered', async ({ page }) => {
    await openShop(page);
    await expect(page.getByLabel('Sort by').locator('option')).toHaveText([
      'Featured',
      'Best selling',
      'Top rated',
      'Newest',
      'Price: low to high',
      'Price: high to low',
      'Name (A–Z)',
    ]);
  });

  test('phones filter in a drawer: focus inside, Escape, apply', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'desktop shows the filters in a sidebar');
    await openShop(page);
    await expect(inMain(page).getByRole('complementary', { name: 'Filters' })).toBeHidden();
    const open = page.getByTestId('filters-button');
    await expect(open).toHaveAccessibleName('Filters');
    await hydrated(open);

    await open.click();
    const drawer = page.getByRole('dialog', { name: 'Filters' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Close filters' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(open).toBeFocused();

    await open.click();
    await drawer.getByRole('radio', { name: /^Rosaries\s*\d+$/ }).check();
    await expect(page).toHaveURL(/category=rosaries/);
    const total = await totalOf(page);
    const apply = drawer.getByRole('button', { name: `Show ${total} products` });
    await expect(apply).toBeVisible();
    await apply.click();
    await expect(drawer).toBeHidden();
    await expect(chips(page)).toHaveText(['Rosaries']);
    await expect(open).toHaveAccessibleName('Filters, 1 active');
  });

  test('has no sideways scroll with filters active (en and he)', async ({ page }) => {
    for (const locale of ['en', 'he']) {
      await openShop(page, `/${locale}/shop?category=rosaries&material=wood,silver&max=20&q=rosary`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('best sellers / favourites strip and cards', () => {
  test('the strip never claims sales that did not happen, and scrolls with the keyboard', async ({ page, request }) => {
    const products = await liveCatalog(request);
    await openShop(page);
    const strip = inMain(page).getByTestId('product-strip');
    const heading = strip.getByRole('heading', { level: 2 });
    if (products) await expect(heading).toHaveText(products.some((p) => p.sold > 0) ? 'Best sellers' : 'Our favourites');
    else await expect(heading).toHaveText(/^(Best sellers|Our favourites)$/);
    await expect(strip.getByTestId('product-card').first()).toBeVisible();
    // Without sales, no card may call itself a best seller.
    if ((await heading.textContent()) === 'Our favourites') {
      await expect(inMain(page).getByTestId('card-badge').filter({ hasText: 'Best seller' })).toHaveCount(0);
    }

    const track = strip.getByRole('region');
    await hydrated(track);
    await track.focus();
    await page.keyboard.press('End');
    await expect.poll(() => track.evaluate((el) => Math.abs(el.scrollLeft))).toBeGreaterThan(0);
    await page.keyboard.press('Home');
    await expect.poll(() => track.evaluate((el) => Math.abs(el.scrollLeft))).toBe(0);
  });

  test('cards show the category, and stars only for reviewed products', async ({ page, request }) => {
    const products = (await liveCatalog(request)) ?? [];
    const reviewed = new Set(products.filter((p) => p.rating.count > 0).map((p) => p._id));
    const byId = new Map(products.map((p) => [p._id, p]));

    await openShop(page);
    const all = cards(page);
    const n = await all.count();
    for (let i = 0; i < n; i += 1) {
      const card = all.nth(i);
      const id = (await card.getAttribute('href'))!.split('/').pop()!;
      const product = byId.get(id);
      if (product) {
        const category = product.category as keyof typeof en.shopFeatures.categories;
        await expect(card).toContainText(en.shopFeatures.categories[category]);
        await expect(card.getByTestId('card-rating')).toHaveCount(reviewed.has(id) ? 1 : 0);
      } else {
        // API unavailable to the test: the card still names one category and never shows "(0)".
        const text = (await card.textContent()) ?? '';
        expect(CATEGORY_LABELS.some((label) => text.includes(label))).toBe(true);
        expect(text).not.toContain('(0)');
      }
    }
    // The stars of a reviewed card read as a rating, never as an empty claim.
    const rated = inMain(page).getByTestId('card-rating').first();
    if (await rated.count()) await expect(rated.getByRole('img')).toHaveAccessibleName(/out of 5 stars/);
  });
});

test.describe('wishlist', () => {
  test.describe.configure({ timeout: 90_000 });
  test('a heart saves the product, and /wishlist lists, adds to cart and removes it', async ({ page }) => {
    await openShop(page);
    const card = grid(page).locator('li').first();
    const name = (await card.getByRole('heading').textContent())!.trim();
    const heart = card.getByTestId('wishlist-toggle');
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect(card.getByRole('status')).toHaveText(`${name} was added to your wishlist.`);
    await expect(inMain(page).getByTestId('wishlist-count')).toHaveText('1');

    await inMain(page).getByTestId('wishlist-link').click();
    await expect(page).toHaveURL(/\/en\/wishlist$/);
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    const items = inMain(page).getByTestId('wishlist-item');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText(name);

    // Kept in the browser.
    await page.reload();
    await expect(items).toHaveCount(1);

    const add = items.first().getByRole('button', { name: new RegExp(`^Add to cart ${escape(name)}`) });
    if (await add.count()) {
      await add.click();
      await expect(inMain(page).getByTestId('cart-count')).toHaveText('1');
    } else {
      await expect(items.first().getByRole('link', { name: /^Choose options/ })).toBeVisible();
    }

    await items.first().getByRole('button', { name: new RegExp(`^Remove ${escape(name)}`) }).click();
    await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeFocused();
    await expect(inMain(page).getByRole('link', { name: 'Browse the shop' })).toHaveAttribute('href', '/en/shop');
  });

  test('has no serious accessibility violations (en and he)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const locale of ['en', 'he']) {
      await page.goto(`/${locale}/wishlist`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(inMain(page).getByRole('link', { name: /.+/ }).last()).toBeVisible(); // empty state
      await expectNoSeriousA11yIssues(page);
    }
    await openShop(page, '/he/shop');
    await grid(page).getByTestId('wishlist-toggle').first().click();
    await page.goto('/he/wishlist');
    await expect(inMain(page).getByTestId('wishlist-item')).toHaveCount(1);
    await expectNoSeriousA11yIssues(page);
  });
});

test.describe('product page features', () => {
  test.describe.configure({ timeout: 90_000 });
  test('rating summary, reviews section and form validation', async ({ page }) => {
    await page.goto(await firstProductHref(page));
    await expect(inMain(page).getByTestId('rating-summary')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Customer reviews' })).toBeVisible();

    const form = inMain(page).getByTestId('review-form');
    const submit = form.getByRole('button', { name: 'Post review' });
    await hydrated(submit);
    await submit.click();
    const name = form.getByLabel('Your name');
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(form.getByText('Please enter your name.')).toBeVisible();
    await expect(form.getByText('Please choose from 1 to 5 stars.')).toBeVisible();
    await expect(form.getByText('Please write your review.')).toBeVisible();

    await name.fill('M');
    await form.getByLabel('Your review').fill('ok');
    await submit.click();
    await expect(form.getByText('Your name needs at least 2 characters.')).toBeVisible();
    await expect(form.getByText('Your review needs at least 3 characters.')).toBeVisible();
    // The star picker is a radio group.
    await expect(form.getByRole('radiogroup', { name: 'Your rating' }).getByRole('radio')).toHaveCount(5);
  });

  test('posts a review (mocked), shows it at once and explains refusals', async ({ page }) => {
    const href = await firstProductHref(page);
    const id = href.split('/').pop()!;
    const answers = [
      { status: 422, body: { error: 'Invalid comment' } },
      { status: 429, body: { error: 'Too many requests, please try again later.' } },
      { status: 201, body: null },
    ];
    const sent: unknown[] = [];
    await page.route(`${API_URL}/product/${id}/reviews`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const body = route.request().postDataJSON();
      sent.push(body);
      const answer = answers.shift()!;
      return route.fulfill({
        status: answer.status,
        contentType: 'application/json',
        body: JSON.stringify(
          answer.body ?? { _id: 'aaaaaaaaaaaaaaaaaaaaaaa1', ...body, website: undefined, createdAt: new Date().toISOString() },
        ),
      });
    });

    await page.goto(href);
    const form = inMain(page).getByTestId('review-form');
    const submit = form.getByRole('button', { name: 'Post review' });
    await hydrated(submit);
    await form.getByLabel('Your name').fill('Maria Rossi');
    await form.getByLabel('Country (optional)').fill('Italy');
    await pickStars(form, 4);
    await form.getByLabel('Title (optional)').fill('Beautiful');
    await form.getByLabel('Your review').fill('It arrived quickly and looks lovely.');

    await submit.click();
    await expect(form.getByRole('alert')).toHaveText('Some details were not accepted. Please check the form and try again.');
    await submit.click();
    await expect(form.getByRole('alert')).toHaveText('You have sent several reviews in a short time. Please try again later.');
    await expect(form.getByLabel('Your review')).toHaveValue('It arrived quickly and looks lovely.');
    await submit.click();
    await expect(form.getByText('Thank you! Your review has been posted.')).toBeVisible();

    expect(sent[0]).toEqual({
      name: 'Maria Rossi',
      country: 'Italy',
      rating: 4,
      title: 'Beautiful',
      comment: 'It arrived quickly and looks lovely.',
      website: '',
    });
    const list = inMain(page).getByTestId('review-list');
    await expect(list.getByRole('listitem').first()).toContainText('It arrived quickly and looks lovely.');
    await expect(list.getByRole('listitem').first().getByRole('img', { name: '4 out of 5 stars' })).toBeVisible();
    await expect(inMain(page).getByTestId('review-summary')).toContainText(/Based on \d+ reviews?/);
  });

  test('a network failure keeps the review and says so', async ({ page }) => {
    const href = await firstProductHref(page);
    await page.route(/\/product\/[a-f\d]{24}\/reviews$/, (route) =>
      route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.fallback(),
    );
    await page.goto(href);
    const form = inMain(page).getByTestId('review-form');
    const submit = form.getByRole('button', { name: 'Post review' });
    await hydrated(submit);
    await form.getByLabel('Your name').fill('Maria');
    await pickStars(form, 5);
    await form.getByLabel('Your review').fill('Lovely');
    await submit.click();
    await expect(form.getByRole('alert')).toHaveText('We could not reach the server. Check your connection and try again.');
  });

  test('similar products and recently viewed', async ({ page }) => {
    await page.goto('/en/shop');
    const hrefs = await cards(page).evaluateAll((els) => els.slice(0, 3).map((el) => el.getAttribute('href')!));
    const [first, second] = hrefs;

    await page.goto(first);
    const firstName = (await page.getByRole('heading', { level: 1 }).textContent())!.trim();
    const similar = inMain(page).getByTestId('similar-products');
    await expect(similar.getByRole('heading', { name: 'You may also like' })).toBeVisible();
    const similarLinks = await similar.getByTestId('product-card').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(similarLinks.length).toBeGreaterThan(0);
    expect(similarLinks.length).toBeLessThanOrEqual(4);
    expect(similarLinks).not.toContain(first);
    // Nothing viewed before this product yet.
    await expect(inMain(page).getByTestId('recently-viewed')).toHaveCount(0);

    await page.goto(second);
    const recent = inMain(page).getByTestId('recently-viewed');
    await expect(recent.getByRole('heading', { name: 'Recently viewed' })).toBeVisible();
    await expect(recent.getByTestId('product-card')).toHaveCount(1);
    await expect(recent.getByTestId('product-card')).toContainText(firstName);
    await expect(recent.getByTestId('product-card')).toHaveAttribute('href', first);
  });

  test('the wishlist button on the product page, and share copies the link without a share sheet', async ({ page }) => {
    await page.addInitScript(() => {
      // No share sheet (as on most desktops); record what is copied instead of using the real clipboard.
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (text: string) => void ((window as unknown as { __copied: string }).__copied = text) },
        configurable: true,
      });
    });
    const href = await firstProductHref(page);
    await page.goto(href);

    const save = inMain(page).getByRole('button', { name: 'Save to wishlist' });
    await hydrated(save);
    await save.click();
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    await expect(inMain(page).getByTestId('wishlist-count')).toHaveText('1');

    await inMain(page).getByTestId('share-button').click();
    await expect(page.getByTestId('toast')).toHaveText('Link copied. You can paste it anywhere.');
    expect(await page.evaluate(() => (window as unknown as { __copied: string }).__copied)).toMatch(
      new RegExp(`${href.replace(/\//g, '\\/')}$`),
    );
  });

  test('structured data claims a rating only when the page shows one', async ({ page }) => {
    await page.goto(await firstProductHref(page));
    const ld = JSON.parse((await inMain(page).locator('script[type="application/ld+json"]').textContent()) ?? '{}');
    expect(ld['@type']).toBe('Product');
    const summary = inMain(page).getByTestId('rating-summary');
    if ((await summary.textContent())?.includes('No reviews yet')) {
      await expect(summary).toHaveText('No reviews yet. Write the first one');
      expect(ld).not.toHaveProperty('aggregateRating');
      expect(ld).not.toHaveProperty('review');
    } else {
      expect(ld.aggregateRating.reviewCount).toBeGreaterThan(0);
      await expect(summary).toContainText(String(ld.aggregateRating.reviewCount));
    }
  });

  test('renders the reviews right-to-left in Hebrew with no sideways scroll', async ({ page }) => {
    await page.goto(await firstProductHref(page, 'he'));
    await expect(page.getByRole('heading', { level: 2, name: 'חוות דעת של לקוחות' })).toBeVisible();
    await expect(inMain(page).getByTestId('review-form').getByRole('button', { name: 'פרסום חוות הדעת' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('has no serious accessibility violations, form errors shown (en and he)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const locale of ['en', 'he']) {
      await page.goto(await firstProductHref(page, locale));
      const form = inMain(page).getByTestId('review-form');
      const submit = form.locator('button[type="submit"]');
      await hydrated(submit);
      await submit.click();
      await expect(form.locator('[aria-invalid="true"]').first()).toBeVisible();
      await expectNoSeriousA11yIssues(page);
    }
  });
});

test.describe('shop with filters', () => {
  test('has no serious accessibility violations with the drawer or sidebar in use (en and he)', async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const locale of ['en', 'he']) {
      await openShop(page, `/${locale}/shop?category=rosaries&material=wood`);
      if (isMobile) {
        await hydrated(page.getByTestId('filters-button'));
        await page.getByTestId('filters-button').click();
        await expect(page.getByTestId('filter-drawer')).toBeVisible();
      }
      await expectNoSeriousA11yIssues(page);
    }
  });
});

test('the sitemap lists the products and holy places', async ({ page, request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  await page.goto('/en/shop');
  // The cards arrive after the catalogue request: wait for them instead of reading an empty grid on a slow runner.
  await expect(cards(page).first()).toBeVisible();
  const hrefs = await cards(page).evaluateAll((els) => els.map((el) => el.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(xml).toContain(`${href}</loc>`);
  for (const slug of ['latin', 'greek', 'maryswell', 'oldcity', 'city']) expect(xml).toContain(`/en/sites/${slug}</loc>`);
  expect(xml).not.toContain('/wishlist');
});
