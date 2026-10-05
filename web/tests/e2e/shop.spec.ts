import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Page } from '@playwright/test';

// The shop, product and cart pages. Products are read on the server (ISR) from the API,
// so these tests use the live catalogue read-only. The browser never writes to the API
// here; the automatic fixture below blocks and fails any attempt to.

const test = base.extend<{ apiGuard: string[] }>({
  apiGuard: [
    async ({ page }, use) => {
      const writes: string[] = [];
      await page.route(/nazareth-holy-cross-api\.onrender\.com/, (route) => {
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

const CART_KEY = 'nhc.cart.v1';
const LOCAL_IMAGE = '/images/vitrage-bg.jpg';

const testLines = [
  { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Test olive oil', price: 10, img: LOCAL_IMAGE, color: '', quantity: 2 },
  { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Test glass fish', price: 15.5, img: LOCAL_IMAGE, color: 'tomato', quantity: 1 },
];

/** Puts lines in the cart before the first page loads (once, so later changes stick). */
async function seedCart(page: Page, lines: unknown[]) {
  await page.addInitScript(
    ({ key, value }) => {
      if (sessionStorage.getItem('cart-seeded')) return;
      localStorage.setItem(key, value);
      sessionStorage.setItem('cart-seeded', '1');
    },
    { key: CART_KEY, value: JSON.stringify(lines) },
  );
}

async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

// Locators are scoped to <main>: while a streamed page is revealed, React can briefly keep a
// hidden copy of the content outside <main>, which test-id and CSS locators would also match.
const inMain = (page: Page) => page.getByRole('main');
// Cards of the main grid (the strip above it shows cards too).
const cards = (page: Page) => inMain(page).getByTestId('shop-grid').getByTestId('product-card');
const jsonLd = (page: Page) => inMain(page).locator('script[type="application/ld+json"]');
const prices = (page: Page) =>
  cards(page)
    .locator('[data-price]')
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-price'))));

test.describe('shop', () => {
  for (const [locale, title, dir] of [
    ['en', 'Souvenirs from Nazareth', 'ltr'],
    ['he', 'מזכרות מנצרת', 'rtl'],
  ] as const) {
    test(`lists the souvenirs in ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/shop`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(cards(page).first()).toBeVisible();
      const shown = await cards(page).count();
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThanOrEqual(12);
      await expect(page).toHaveTitle(new RegExp(title));
      const ld = JSON.parse((await jsonLd(page).textContent()) ?? '{}');
      expect(ld['@type']).toBe('CollectionPage');
      expect(ld.mainEntity.itemListElement.length).toBeGreaterThanOrEqual(shown);
      await expectNoSidewaysScroll(page);
    });
  }

  test('search narrows the grid, says when nothing matches, and resets', async ({ page }) => {
    await page.goto('/en/shop');
    const name = (await cards(page).first().getByRole('heading').textContent())!.trim();
    const search = page.getByRole('searchbox', { name: 'Search products' });

    await search.fill(name);
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(cards(page).first()).toContainText(name);

    await search.fill('zzzz no such souvenir');
    await expect(page.getByText('No products found matching your criteria.')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);

    await inMain(page).getByRole('button', { name: 'Clear all' }).last().click();
    await expect(search).toHaveValue('');
    await expect(cards(page).first()).toBeVisible();
    await expect(page).not.toHaveURL(/[?&]q=/);
  });

  test('sorts by price and by name', async ({ page }) => {
    await page.goto('/en/shop');
    const sort = page.getByLabel('Sort by');

    await sort.selectOption('priceAsc');
    await expect(page).toHaveURL(/sort=priceAsc/);
    const ascending = await prices(page);
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));

    await sort.selectOption('priceDesc');
    await expect(page).toHaveURL(/sort=priceDesc/);
    const descending = await prices(page);
    expect(descending).toEqual([...descending].sort((a, b) => b - a));

    await sort.selectOption('name');
    const names = await cards(page).getByRole('heading').allTextContents();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })));
  });

  test('pages through the catalogue and keeps the page in the URL', async ({ page }) => {
    await page.goto('/en/shop');
    const count = inMain(page).getByTestId('shop-count');
    await expect(count).toHaveText(/^Showing 1–\d+ of \d+$/);
    const total = Number((await count.textContent())!.match(/of (\d+)/)![1]);
    test.skip(total <= 12, 'the catalogue fits on one page');

    const pager = page.getByRole('navigation', { name: 'Product pages' });
    await pager.getByRole('button', { name: 'Next' }).click();
    await expect(count).toHaveText(/^Showing 13–\d+ of/);
    await expect(page).toHaveURL(/page=2/);
    await expect(count).toBeFocused();

    await page.goBack();
    await expect(count).toHaveText(/^Showing 1–12 of/);

    await page.goto('/en/shop?page=2&sort=priceDesc');
    await expect(count).toHaveText(/^Showing 13–\d+ of/);
    await expect(page.getByLabel('Sort by')).toHaveValue('priceDesc');
  });

  test('has no serious accessibility violations (en and he)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const locale of ['en', 'he']) {
      await page.goto(`/${locale}/shop`);
      await expect(cards(page).first()).toBeVisible();
      await expectNoSeriousA11yIssues(page);
    }
  });
});

test.describe('product page', () => {
  test('shows the product, its structured data, and adds it to the cart', async ({ page }) => {
    await page.goto('/en/shop');
    const card = cards(page).first();
    const name = (await card.getByRole('heading').textContent())!.trim();
    await card.click();

    await expect(page).toHaveURL(/\/en\/shop\/[a-f\d]{24}$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
    await expect(page).toHaveTitle(new RegExp(name));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\//);

    const ld = JSON.parse((await jsonLd(page).textContent()) ?? '{}');
    expect(ld).toMatchObject({ '@type': 'Product', name, offers: { priceCurrency: 'USD' } });
    expect(ld.offers.availability).toMatch(/schema\.org\/(InStock|OutOfStock)$/);

    // A product sold in several colours or designs needs one picked first.
    const options = page.getByRole('group', { name: /^(Colour|Design)$/ }).getByRole('radio');
    if (await options.count()) await options.first().check();

    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(inMain(page).getByTestId('quantity')).toHaveText('2');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Product added to cart!')).toBeVisible();
    await expect(inMain(page).getByTestId('quantity')).toHaveText('1');
    await expect(inMain(page).getByTestId('cart-count')).toHaveText('2');

    await page.getByRole('link', { name: 'View cart', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/cart$/);
    const line = inMain(page).getByTestId('cart-line');
    await expect(line).toHaveCount(1);
    await expect(line).toContainText(name);
    await expect(line.getByTestId('quantity')).toHaveText('2');
  });

  test('asks for a colour before adding a product that comes in colours', async ({ page }) => {
    const response = await page.goto('/en/shop/66c9e1266552e5d9f5249600'); // "Vitrage glass fish"
    const colours = page.getByRole('group', { name: 'Colour' });
    test.skip(response?.status() === 404 || !(await colours.count()), 'that product no longer comes in colours');

    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Please select a color.')).toBeVisible();
    await expect(colours.getByRole('radio').first()).toBeFocused();

    const second = colours.getByRole('radio').nth(1);
    await second.check();
    await expect(page.getByRole('button', { name: 'Show image 3 of', exact: false })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Product added to cart!')).toBeVisible();

    await page.goto('/en/cart');
    await expect(inMain(page).getByTestId('cart-line')).toContainText('Colour:');
  });

  test('opens the photo full screen and closes it with Escape', async ({ page }) => {
    await page.goto('/en/shop');
    await cards(page).first().click();
    const enlarge = page.getByRole('button', { name: /^Enlarge image/ });
    await enlarge.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(enlarge).toBeFocused();
  });

  test('renders right-to-left in Hebrew', async ({ page }) => {
    await page.goto('/he/shop');
    await cards(page).first().click();
    await expect(page).toHaveURL(/\/he\/shop\/[a-f\d]{24}$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('button', { name: 'הוספה לסל' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'להמשך הקנייה' })).toHaveAttribute('href', '/he/shop');
    await expectNoSidewaysScroll(page);
  });

  test('an unknown or malformed id shows "Product not found"', async ({ page }) => {
    for (const id of ['000000000000000000000000', 'not-a-product']) {
      await page.goto(`/en/shop/${id}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Product not found.' })).toBeVisible();
      await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
      await expect(page.getByRole('link', { name: 'Back To Shopping' })).toHaveAttribute('href', '/en/shop');
    }
  });

  test('has no serious accessibility violations (en and he)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const locale of ['en', 'he']) {
      await page.goto(`/${locale}/shop`);
      // Load the product page itself (a click would be a client-side navigation, whose
      // <title> can arrive a moment after the content).
      await page.goto((await cards(page).first().getAttribute('href'))!);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page).toHaveTitle(/\S/);
      await expectNoSeriousA11yIssues(page);
    }
  });
});

test.describe('cart', () => {
  test('shows the lines and the order summary, and updates both', async ({ page }) => {
    await seedCart(page, testLines);
    await page.goto('/en/cart');

    await expect(inMain(page).getByTestId('cart-line')).toHaveCount(2);
    await expect(inMain(page).getByTestId('cart-count-text')).toHaveText('3 items in your cart');
    // 2 × $10 + $15.50 = $35.50; 10% off = $3.55; + $5 shipping = $36.95
    await expect(inMain(page).getByTestId('cart-subtotal')).toHaveText('$35.50');
    await expect(inMain(page).getByTestId('cart-discount')).toHaveText(/3\.55/);
    await expect(inMain(page).getByTestId('cart-shipping')).toHaveText('$5.00');
    await expect(inMain(page).getByTestId('cart-total')).toHaveText('$36.95');
    await expect(inMain(page).getByTestId('cart-line').nth(1)).toContainText('Colour: tomato');

    const oil = page.getByRole('group', { name: 'Quantity of Test olive oil' });
    await oil.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(oil.getByTestId('quantity')).toHaveText('3');
    await expect(inMain(page).getByTestId('cart-subtotal')).toHaveText('$45.50');
    await expect(inMain(page).getByTestId('cart-total')).toHaveText('$45.95');

    await page.getByRole('button', { name: 'Remove Test glass fish' }).click();
    await expect(inMain(page).getByTestId('cart-line')).toHaveCount(1);
    await expect(page.getByRole('status').filter({ hasText: 'Test glass fish was removed' })).toBeAttached();

    await expect(page.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/en/checkout');

    // The cart is kept in the browser.
    await page.reload();
    await expect(inMain(page).getByTestId('cart-line')).toHaveCount(1);
    await expect(inMain(page).getByTestId('cart-total')).toHaveText('$32.00');
  });

  test('says when the cart is empty and leads back to the shop', async ({ page }) => {
    await seedCart(page, [testLines[0]]);
    await page.goto('/en/cart');
    await page.getByRole('button', { name: 'Remove Test olive oil' }).click();
    const heading = page.getByRole('heading', { name: 'Your Cart is Empty' });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByRole('link', { name: 'Back To Shopping' })).toHaveAttribute('href', '/en/shop');
  });

  test('renders right-to-left in Hebrew', async ({ page }) => {
    await seedCart(page, testLines);
    await page.goto('/he/cart');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('סל הקניות שלכם');
    await expect(page.getByRole('heading', { name: 'סיכום ההזמנה' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'לתשלום' })).toHaveAttribute('href', '/he/checkout');
    await expectNoSidewaysScroll(page);
  });

  test('has no serious accessibility violations (filled and empty, en and he)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedCart(page, testLines);
    for (const locale of ['en', 'he']) {
      await page.goto(`/${locale}/cart`);
      await expect(inMain(page).getByTestId('cart-line').first()).toBeVisible();
      await expectNoSeriousA11yIssues(page);
    }
    await page.evaluate((key) => localStorage.setItem(key, '[]'), CART_KEY);
    await page.goto('/en/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart is Empty' })).toBeVisible();
    await expectNoSeriousA11yIssues(page);
  });
});
