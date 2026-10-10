import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { MEDIA } from '../../src/data/media';
import { PLACE_OF_TOPIC } from '../../src/data/places/places';
import en from '../../src/messages/en.json';
import he from '../../src/messages/he.json';

// Pilgrim pages: planner, visitor guide, Gospel, prayer wall, contact, gallery, FAQ, legal pages and site search.
// Nothing leaves the local server: external requests are aborted and the forms' POSTs are mocked.

const t = en.pilgrim;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

async function mockPost(page: Page, url: string, status: number, body: unknown) {
  const posted: unknown[] = [];
  await page.route(url, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    posted.push(request.postDataJSON());
    return route.fulfill({
      status,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  });
  return posted;
}

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

const PAGES = [
  { path: '/plan', title: t.plan.meta.title, h1: t.plan.hero.title, ld: ['WebPage', 'BreadcrumbList'] },
  { path: '/visit', title: t.visit.meta.title, h1: t.visit.hero.title, ld: ['FAQPage', 'BreadcrumbList'] },
  { path: '/gospel', title: t.gospel.meta.title, h1: t.gospel.hero.title, ld: ['CollectionPage', 'BreadcrumbList'] },
  { path: '/gallery', title: t.gallery.meta.title, h1: t.gallery.hero.title, ld: ['ImageGallery', 'BreadcrumbList'] },
  { path: '/prayers', title: t.prayers.meta.title, h1: t.prayers.hero.title, ld: ['CollectionPage', 'BreadcrumbList'] },
  { path: '/contact', title: t.contact.meta.title, h1: t.contact.hero.title, ld: ['ContactPage', 'BreadcrumbList'] },
  { path: '/faq', title: t.faq.meta.title, h1: t.faq.title, ld: ['FAQPage', 'BreadcrumbList'] },
  { path: '/privacy', title: t.legal.privacy.meta.title, h1: t.legal.privacy.title, ld: ['WebPage', 'BreadcrumbList'] },
  { path: '/terms', title: t.legal.terms.meta.title, h1: t.legal.terms.title, ld: ['WebPage', 'BreadcrumbList'] },
  { path: '/shipping-returns', title: t.legal.shipping.meta.title, h1: t.legal.shipping.title, ld: ['WebPage', 'BreadcrumbList'] },
];

test.describe('every pilgrim page', () => {
  for (const p of PAGES) {
    test(`${p.path} has localized metadata, structured data and no serious accessibility violations`, async ({ page }) => {
      const response = await page.goto(`/en${p.path}`);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(new RegExp(p.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/en${p.path}$`));
      await expect(page.locator('link[rel="alternate"][hreflang="he"]')).toHaveAttribute('href', new RegExp(`/he${p.path}$`));
      expect(await jsonLdTypes(page)).toEqual(expect.arrayContaining(p.ld));
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test('are translated and right-to-left in Hebrew', async ({ page }) => {
    for (const p of PAGES.slice(0, 3)) {
      await page.goto(`/he${p.path}`);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    }
    await page.goto('/he/visit');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(he.pilgrim.visit.hero.title);
  });

  test('are listed in the sitemap with every language, and linked from the footer', async ({ page, request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    for (const p of PAGES) expect(xml).toContain(`/en${p.path}</loc>`);
    expect(xml).toContain('hreflang="ar" href="https://nazarethholycross.com/ar/plan"');

    await page.goto('/en');
    const footer = page.getByRole('contentinfo');
    for (const key of ['plan', 'visit', 'gospel', 'gallery', 'prayers', 'contact', 'faq', 'shipping', 'privacy', 'terms'] as const) {
      await expect(footer.getByRole('link', { name: t.nav[key], exact: true })).toBeVisible();
    }
  });
});

test.describe('planner', () => {
  test('lays out the default itinerary and keeps the answers in the URL', async ({ page }) => {
    await page.goto('/en/plan');
    await expect(page.getByRole('heading', { name: 'Day 1' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Day 2' })).toBeVisible();

    await page.getByRole('radio', { name: /^1/ }).check({ force: true });
    await expect(page).toHaveURL(/days=1/);
    await expect(page.getByRole('heading', { name: 'Day 2' })).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Markets and crafts' }).check({ force: true });
    await page.getByRole('radio', { name: /Relaxed/ }).check({ force: true });
    await expect(page).toHaveURL(/interests=markets/);
    await expect(page).toHaveURL(/pace=relaxed/);
    // one relaxed day = two stops, and the markets come first
    await expect(page.getByRole('link', { name: 'The Old City', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'The City of Nazareth', exact: true })).toBeVisible();
    await expect(page.getByText('1 day · 2 stops')).toBeVisible();
  });

  test('restores a shared plan from the URL', async ({ page }) => {
    await page.goto('/en/plan?days=3&interests=gospel&pace=full&start=2026-11-02');
    await expect(page.getByRole('heading', { name: /^Day 3/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Day 1/ })).toContainText('Monday, November 2, 2026');
    await expect(page.getByRole('checkbox', { name: 'Gospel sites' })).toBeChecked();
    await expect(page.getByRole('radio', { name: /Full/ })).toBeChecked();
    await expect(page.getByLabel(t.plan.form.start)).toHaveValue('2026-11-02');
  });

  test('downloads a calendar file made in the browser', async ({ page }) => {
    await page.goto('/en/plan?days=1&pace=balanced&start=2026-11-02');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: t.plan.actions.calendar }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('nazareth-pilgrimage.ics');
    const text = readFileSync((await download.path())!, 'utf8');
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text.match(/BEGIN:VEVENT/g)?.length).toBeGreaterThanOrEqual(3);
    expect(text).toContain('DTSTART:20261102T090000');
    expect(text).toContain('LOCATION:');
    expect(text).toContain('\r\n');
    await expect(page.getByRole('status').filter({ hasText: t.plan.calendarDone })).toBeVisible();
  });

  test('shows the walking times table', async ({ page }) => {
    await page.goto('/en/plan');
    const table = page.getByRole('table', { name: t.plan.walking.caption });
    await expect(table).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(6);
  });
});

test.describe('visitor guide and Gospel', () => {
  test('shows the climate table for twelve months and the visitor questions', async ({ page }) => {
    await page.goto('/en/visit');
    const table = page.getByRole('table', { name: t.visit.climate.caption });
    await expect(table.getByRole('row')).toHaveCount(13);
    await expect(table.getByRole('row', { name: /^July/ })).toContainText('32°');
    await expect(page.getByRole('heading', { name: t.visit.faq.free.q })).toBeVisible();
  });

  test('links every passage to its holy site', async ({ page }) => {
    await page.goto('/en/gospel');
    await expect(page.getByRole('blockquote')).toHaveCount(8);
    await expect(page.locator('cite').first()).toHaveText('Luke 1:26-27');
    await expect(page.getByRole('link', { name: /Mary's Well/ })).toHaveAttribute('href', '/en/sites/maryswell');
    await page.goto('/he/gospel');
    await expect(page.locator('cite').first()).toHaveText(he.pilgrim.gospel.p.luke126.ref);
  });
});

test.describe('prayer wall', () => {
  test('renders the wall (or its empty or error state) with the category filter', async ({ page }) => {
    await page.goto('/en/prayers?category=Peace');
    await expect(page.getByRole('link', { name: 'Peace', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(
      page
        .getByRole('heading', { name: new RegExp(`${t.prayers.wall.emptyTitle}|${t.prayers.wall.errorTitle}`) })
        .or(page.getByText(/\d+ prayers?$/)),
    ).toBeVisible();
    // an unknown category is ignored, not sent to the API
    await page.goto('/en/prayers?category=<script>');
    await expect(page.getByRole('link', { name: 'All', exact: true })).toHaveAttribute('aria-current', 'true');
  });

  test('validates, posts the prayer to the API and confirms', async ({ page }) => {
    const posted = await mockPost(page, '**/prayer/create', 201, { _id: '1', name: 'Maria', prayer: 'x' });
    await page.goto('/en/prayers');
    const form = page.getByRole('form', { name: t.prayers.form.title });
    await form.getByRole('button', { name: t.prayers.form.submit }).click();
    await expect(form.getByText(t.prayers.errors.required).first()).toBeVisible();
    expect(posted).toHaveLength(0);

    await form.getByLabel(t.prayers.form.name).fill('Maria');
    await form.getByLabel(t.prayers.form.country).selectOption('IT');
    await form.getByLabel(t.prayers.form.category).selectOption('World Peace');
    await form.getByLabel(t.prayers.form.prayer).fill('Visit www.spam.example');
    await form.getByRole('button', { name: t.prayers.form.submit }).click();
    await expect(form.getByText(t.prayers.errors.noLinks)).toBeVisible();

    await form.getByLabel(t.prayers.form.prayer).fill('Peace for every family.');
    await form.getByRole('button', { name: t.prayers.form.submit }).click();
    await expect(page.getByRole('heading', { name: t.prayers.form.sent })).toBeFocused();
    expect(posted).toEqual([{ name: 'Maria', country: 'Italy', prayer: 'Peace for every family.', category: 'World Peace' }]);
  });

  test('tells the visitor when the API refuses with 429', async ({ page }) => {
    await mockPost(page, '**/prayer/create', 429, { error: 'Too many requests' });
    await page.goto('/en/prayers');
    const form = page.getByRole('form', { name: t.prayers.form.title });
    await form.getByLabel(t.prayers.form.name).fill('Maria');
    await form.getByLabel(t.prayers.form.country).selectOption('IT');
    await form.getByLabel(t.prayers.form.prayer).fill('Peace for every family.');
    await form.getByRole('button', { name: t.prayers.form.submit }).click();
    await expect(form.getByRole('alert')).toHaveText(t.prayers.errors.rateLimited);
  });
});

test.describe('contact', () => {
  async function fill(page: Page) {
    const form = page.getByRole('form', { name: t.contact.form.title });
    await form.getByLabel(t.contact.form.fullName).fill('Maria Rossi');
    await form.getByLabel(t.contact.form.email).fill('maria@example.com');
    await form.getByLabel(t.contact.form.phone).fill('+39 312 345 6789');
    await form.getByLabel(t.contact.form.msg).fill('A question about my order.');
    return form;
  }

  test('validates every field before sending anything', async ({ page }) => {
    const posted = await mockPost(page, '**/contact/contact_us_request', 201, 'Created');
    await page.goto('/en/contact');
    const form = page.getByRole('form', { name: t.contact.form.title });
    await form.getByRole('button', { name: t.contact.form.submit }).click();
    await expect(form.getByText(t.contact.errors.required)).toHaveCount(3); // the phone is optional
    await expect(form.getByLabel(t.contact.form.phone)).not.toHaveAttribute('required', '');
    await form.getByLabel(t.contact.form.email).fill('nope');
    await form.getByLabel(t.contact.form.phone).fill('abc');
    await expect(form.getByText(t.contact.errors.invalidEmail)).toBeVisible();
    // the optional phone had no error yet, so it is checked on the next submit: a typed phone must still be valid
    await form.getByRole('button', { name: t.contact.form.submit }).click();
    await expect(form.getByText(t.contact.errors.invalidPhone)).toBeVisible();
    expect(posted).toHaveLength(0);
  });

  test('without a phone number: sends the three required fields only', async ({ page }) => {
    const posted = await mockPost(page, '**/contact/contact_us_request', 201, 'Created');
    await page.goto('/en/contact');
    const form = await fill(page);
    await form.getByLabel(t.contact.form.phone).fill('');
    await form.getByRole('button', { name: t.contact.form.submit }).click();
    await expect(page.getByRole('heading', { name: t.contact.form.sent })).toBeFocused();
    expect(posted).toEqual([{ fullName: 'Maria Rossi', email: 'maria@example.com', msg: 'A question about my order.' }]);
  });

  test('sends the four fields (with the optional phone) and confirms', async ({ page }) => {
    const posted = await mockPost(page, '**/contact/contact_us_request', 201, 'Created');
    await page.goto('/en/contact');
    const form = await fill(page);
    await form.getByRole('button', { name: t.contact.form.submit }).click();
    await expect(page.getByRole('heading', { name: t.contact.form.sent })).toBeFocused();
    expect(posted).toEqual([
      { fullName: 'Maria Rossi', email: 'maria@example.com', phone: '+39 312 345 6789', msg: 'A question about my order.' },
    ]);
    await page.getByRole('button', { name: t.contact.form.another }).click();
    await expect(page.getByLabel(t.contact.form.fullName)).toBeFocused();
  });

  test('handles 429, a rejected message and a dead network', async ({ page }) => {
    await page.goto('/en/contact');
    for (const [status, message] of [
      [429, t.contact.errors.rateLimited],
      [422, t.contact.errors.invalid],
      [500, t.contact.errors.server],
    ] as const) {
      await page.unroute('**/contact/contact_us_request').catch(() => undefined);
      await mockPost(page, '**/contact/contact_us_request', status, { error: 'x' });
      const form = await fill(page);
      await form.getByRole('button', { name: t.contact.form.submit }).click();
      await expect(form.getByRole('alert')).toHaveText(message);
    }
    await page.unroute('**/contact/contact_us_request');
    await page.route('**/contact/contact_us_request', (route) => route.abort());
    const form = page.getByRole('form', { name: t.contact.form.title });
    await form.getByRole('button', { name: t.contact.form.submit }).click();
    await expect(form.getByRole('alert')).toHaveText(t.contact.errors.network);
  });

  test('offers the e-mail address and no WhatsApp link until a number is configured', async ({ page }) => {
    await page.goto('/en/contact');
    await expect(page.getByRole('link', { name: t.contact.direct.email })).toHaveAttribute('href', /^mailto:/);
    await expect(page.getByRole('link', { name: new RegExp(t.contact.direct.whatsapp) })).toHaveCount(0);
  });
});

test.describe('gallery', () => {
  test('filters by holy site, keeps the filter in the URL and opens the lightbox', async ({ page }) => {
    // The licensed photos, grouped by topic; a site's count is the sum of its topics.
    const ofSite = (slug: string) => MEDIA.filter((item) => PLACE_OF_TOPIC[item.topic] === slug).length;
    const wellCount = ofSite('maryswell');
    await page.goto('/en/gallery');
    await expect(page.getByRole('status')).toHaveText(`${MEDIA.length} photos`);
    await page.getByRole('button', { name: `Mary's Well ${wellCount}`, exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(`${wellCount} photos`);
    await expect(page).toHaveURL(/site=maryswell/);
    await expect(page.locator('#gallery-well')).toBeVisible();
    await expect(page.locator('#gallery-basilica')).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('status')).toHaveText(`${wellCount} photos`);

    await page.getByRole('button', { name: new RegExp(`photo 1 of ${wellCount}`) }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('img')).toHaveAttribute('alt', new RegExp(`photo 2 of ${wellCount}`));
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: new RegExp(`photo 1 of ${wellCount}`) })).toBeFocused();
  });
});

test.describe('FAQ and legal pages', () => {
  test('the FAQ quotes the real shipping fee, discount and candle price', async ({ page }) => {
    await page.goto('/en/faq');
    await expect(page.locator('#shop-shipping')).toContainText('$5.00');
    await expect(page.locator('#shop-discount')).toContainText('10%');
    await expect(page.locator('#prayer-candle')).toContainText('$3.00');
    await expect(page.locator('article h3')).toHaveCount(17);
  });

  test('privacy lists the data kept and the browser storage; shipping and terms quote the same figures', async ({ page }) => {
    await page.goto('/en/privacy');
    await expect(page.getByText(/The prayer wall: the name, country/)).toBeVisible();
    await expect(page.getByText('Your shopping cart and wishlist.')).toBeVisible();
    await page.goto('/en/shipping-returns');
    await expect(page.getByText('Shipping: $5.00 per order.')).toBeVisible();
    await expect(page.getByText(/Discount: 10% off the items/)).toBeVisible();
    await page.goto('/en/terms');
    await expect(page.getByText(/discount of 10%.*\$5.00/)).toBeVisible();
  });
});

test.describe('site search', () => {
  test('Ctrl+K opens the palette, finds a page in the visitor language and goes there with Enter', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'keyboard shortcut');
    await page.goto('/en', { waitUntil: 'networkidle' });
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: t.search.label });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox')).toBeFocused();
    await dialog.getByRole('combobox').fill('shipping');
    await expect(dialog.getByRole('option').first()).toBeVisible();
    await expect(dialog.getByRole('option', { name: /How much is shipping/ })).toBeVisible();
    await dialog.getByRole('combobox').press('ArrowDown');
    await dialog.getByRole('combobox').fill('visitor guide');
    await dialog.getByRole('combobox').press('Enter');
    await expect(page).toHaveURL(/\/en\/visit$/);
    await expect(dialog).toBeHidden();
  });

  test('the footer button opens it, Escape closes it, and Hebrew searches Hebrew', async ({ page }) => {
    await page.goto('/he');
    await page.getByRole('contentinfo').getByRole('button', { name: he.pilgrim.search.open }).click();
    const dialog = page.getByRole('dialog', { name: he.pilgrim.search.label });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox').fill('נצרת בבשורות');
    await expect(dialog.getByRole('option', { name: /נצרת בבשורות/ }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('the search palette passes accessibility checks while open', async ({ page }) => {
    await page.goto('/en/plan');
    await page.getByRole('contentinfo').getByRole('button', { name: t.search.open }).click();
    await page.getByRole('combobox').fill('candle');
    await expect(page.getByRole('option').first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('/search works without JavaScript logic: a plain GET form with server-rendered results', async ({ page }) => {
    await page.goto('/en/search?q=candle');
    await expect(page.getByRole('status')).toContainText('result');
    await expect(page.getByRole('link', { name: /How does lighting a candle work/ })).toHaveAttribute('href', '/en/faq#prayer-candle');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.goto('/en/search?q=zzzzzz');
    await expect(page.getByRole('status')).toContainText('No results');
  });

  test('serves a static index per language', async ({ request }) => {
    for (const locale of ['en', 'he', 'ar']) {
      const res = await request.get(`/${locale}/search-index.json`);
      expect(res.status()).toBe(200);
      const entries = (await res.json()) as { id: string; type: string; title: string; href: string }[];
      expect(entries.length).toBeGreaterThan(40);
      expect(new Set(entries.map((e) => e.type))).toEqual(new Set(['page', 'site', 'faq', 'gospel']));
      expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    }
    const hebrew = (await (await request.get('/he/search-index.json')).json()) as { title: string }[];
    expect(hebrew.some((e) => e.title === he.pilgrim.nav.plan)).toBe(true);
  });
});
