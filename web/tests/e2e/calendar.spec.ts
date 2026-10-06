import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addMonths, nazarethToday, nextFeasts } from '../../src/lib/liturgical';
import ar from '../../src/messages/ar.json';
import en from '../../src/messages/en.json';
import he from '../../src/messages/he.json';

// The Christian calendar on /live (docs/LITURGICAL-CALENDAR.md): the month grid with the keyboard, the filter, the
// upcoming feasts, "add to calendar", right to left, small screens, accessibility, and no structured data for feasts.
// The live status poll of the page is answered here: nothing reaches the real API from the browser.

const cal = en.pilgrim.calendar;
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };

test.beforeEach(async ({ page }) => {
  await page.route('**/live/status', (route) => route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ live: false }) }));
});

const monthName = (locale: string, iso: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC', numberingSystem: 'latn' }).format(new Date(`${iso}T12:00:00Z`));

async function openCalendar(page: Page, locale = 'en') {
  await page.goto(`/${locale}/live`);
  const section = page.locator('#calendar');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole('grid')).toBeVisible();
  return section;
}

test.describe('Christian calendar on /live', () => {
  test('shows this month in Nazareth, today marked, and the next feasts', async ({ page }) => {
    const section = await openCalendar(page);
    const today = nazarethToday();
    await expect(section.getByRole('heading', { level: 2, name: cal.title })).toBeVisible();
    await expect(section.getByRole('grid')).toHaveAccessibleName(monthName('en', today));
    const todayCell = section.locator(`button[data-date="${today}"]`);
    await expect(todayCell).toHaveAttribute('aria-current', 'date');
    await expect(todayCell).toHaveAttribute('tabindex', '0');

    const upcoming = section.getByTestId('calendar-upcoming').getByRole('listitem');
    await expect(upcoming).toHaveCount(8);
    const first = nextFeasts(today, 1, 'all')[0];
    await expect(upcoming.first()).toContainText(cal.feasts[first.id as keyof typeof cal.feasts].name);
  });

  test('works with the keyboard: arrows move the day, Page Down the month, the focus follows', async ({ page }) => {
    const section = await openCalendar(page);
    const today = nazarethToday();
    await section.locator(`button[data-date="${today}"]`).focus();
    await page.keyboard.press('ArrowDown');
    const week = await page.evaluate(() => document.activeElement?.getAttribute('data-date'));
    expect(week).toBe(new Date(Date.parse(`${today}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10));
    await page.keyboard.press('PageDown');
    const next = addMonths(week!, 1);
    await expect(section.getByRole('grid')).toHaveAccessibleName(monthName('en', next));
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-date'))).toBe(next);
    // One tab stop in the grid: Tab leaves it.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('[role="grid"]') === null)).toBe(true);
  });

  test('the filter keeps one tradition, in the list and in the grid', async ({ page }) => {
    const section = await openCalendar(page);
    await section.getByRole('radio', { name: cal.filter.orthodox }).check();
    const items = section.getByTestId('calendar-upcoming').getByRole('listitem');
    await expect(items).toHaveCount(8);
    for (const item of await items.all()) await expect(item).toContainText(cal.tradition.orthodox);
    const first = nextFeasts(nazarethToday(), 1, 'orthodox')[0];
    const texts = cal.feasts[first.id as keyof typeof cal.feasts];
    await expect(items.first()).toContainText(first.traditions.length === 1 && 'orthodoxName' in texts ? texts.orthodoxName : texts.name);
    await expect(items.first().locator('time')).toHaveAttribute('dateTime', first.date);
  });

  test('"Add to calendar" downloads an .ics file made in the page', async ({ page }) => {
    const section = await openCalendar(page);
    const item = section.getByTestId('calendar-upcoming').getByRole('listitem').first();
    const [download] = await Promise.all([page.waitForEvent('download'), item.getByRole('button', { name: new RegExp(`^${cal.ics.add}: `) }).click()]);
    expect(download.suggestedFilename()).toMatch(/^[a-zA-Z0-9]+-\d{4}-\d{2}-\d{2}\.ics$/);
    const text = readFileSync((await download.path())!, 'utf8');
    expect(text).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(text).toMatch(/DTSTART;VALUE=DATE:\d{8}\r\n/);
    expect(text).toContain('URL:');
  });

  test('right to left in Hebrew and Arabic: mirrored arrows, own words, Saturday-first week in Arabic', async ({ page }) => {
    for (const [locale, messages] of [['he', he], ['ar', ar]] as const) {
      const section = await openCalendar(page, locale);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(section.getByRole('heading', { level: 2, name: messages.pilgrim.calendar.title })).toBeVisible();
      const today = nazarethToday();
      await section.locator(`button[data-date="${today}"]`).focus();
      await page.keyboard.press('ArrowLeft'); // to the left is later in a right-to-left week
      const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-date'))).toBe(tomorrow);
      // The first column is the first day of the week: Sunday in Hebrew, Saturday in Arabic.
      const firstHeader = await section.getByRole('columnheader').first().textContent();
      const expected = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(1970, 0, locale === 'he' ? 4 : 3, 12)));
      expect(firstHeader).toContain(expected);
    }
  });

  test('has no accessibility violations (WCAG 2.2 AA), also with a day of feasts chosen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const section = await openCalendar(page);
    await section.getByRole('button', { name: cal.month.next }).click();
    // A day with something on it (its name is "<date>: <feasts>"), so the day panel shows feasts and buttons.
    const feastDay = section.locator('button[data-date][aria-label*=": "]').first();
    if (await feastDay.count()) await feastDay.click();
    const results = await new AxeBuilder({ page }).include('#calendar').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
  });

  test('fits a 320px screen in Arabic without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openCalendar(page, 'ar');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('gives structured data to broadcasts only, never to feasts', async ({ page }) => {
    await openCalendar(page);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const names = blocks.flatMap((b) => {
      const data = JSON.parse(b) as { '@graph'?: { '@type': string; name?: string }[] };
      return (data['@graph'] ?? []).filter((n) => n['@type'] === 'Event').map((n) => n.name ?? '');
    });
    const feastNames = Object.values(cal.feasts).flatMap((f) => [f.name, 'orthodoxName' in f ? f.orthodoxName : f.name]);
    expect(names.filter((n) => feastNames.includes(n))).toEqual([]);
  });
});
