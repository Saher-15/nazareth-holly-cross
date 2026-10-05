import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { broadcasts, LIVE_WINDOW_MS, liveState } from '../../src/components/community/liveSchedule';
import en from '../../src/messages/en.json';
import he from '../../src/messages/he.json';

// The review form posts straight to the API from the browser. Every test blocks that request by default,
// and the tests that need an answer mock it: no review ever reaches the real API.
const ADD_REVIEW = '**/review/addReview';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

async function mockAddReview(page: Page, status: number, body: unknown) {
  const posted: unknown[] = [];
  await page.route(ADD_REVIEW, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    posted.push(request.postDataJSON());
    return route.fulfill({
      status,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify(body),
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

test.beforeEach(async ({ page }) => {
  await page.route(ADD_REVIEW, (route) => route.abort());
});

test.describe('reviews page', () => {
  const form = en.pray;
  const errors = en.communityPage.reviews.form.errors;

  // (Next's route announcer is an alert too, so look inside the form.)
  const alertIn = (page: Page) => page.getByRole('form', { name: form.formTitle }).getByRole('alert');

  const fill = async (page: Page) => {
    await page.getByLabel(form.placeholderFullName).fill('  Maria Rossi ');
    await page.getByLabel(form.placeholderCountry).fill('Rome, Italy');
    await page.getByLabel(form.placeholderMessage).fill('A blessed visit, thank you.');
  };

  test('renders in English with the share form and the wall', async ({ page }) => {
    await page.goto('/en/reviews');
    await expect(page).toHaveTitle(new RegExp(en.communityPage.reviews.metaTitle));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/reviews$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.home.voicesTitle);
    await expect(page.getByRole('heading', { name: form.formTitle })).toBeVisible();

    const wall = page.getByRole('region', { name: form.messagesTitle });
    await expect(
      wall
        .getByRole('listitem')
        .first()
        .or(wall.getByText(form.noMessages))
        .or(wall.getByText(en.communityPage.reviews.unavailableTitle)),
    ).toBeVisible();
    await expect(page.locator('header a[aria-current="page"]')).toHaveAttribute('href', '/en/reviews');
  });

  test('renders right-to-left in Hebrew', async ({ page }) => {
    await page.goto('/he/reviews');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(he.home.voicesTitle);
    await expect(page.getByLabel(he.pray.placeholderFullName)).toBeVisible();
    await expect(page.getByRole('button', { name: he.pray.submitButton })).toBeVisible();
  });

  test('checks the fields before anything is sent', async ({ page }) => {
    const sent: string[] = [];
    page.on('request', (r) => r.url().includes('/review/addReview') && sent.push(r.method()));
    await page.goto('/en/reviews');
    await page.getByRole('button', { name: form.submitButton }).click();

    const name = page.getByLabel(form.placeholderFullName);
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(errors.nameRequired)).toBeVisible();
    await expect(page.getByText(errors.placeRequired)).toBeVisible();
    await expect(page.getByText(errors.messageRequired)).toBeVisible();

    await page.getByLabel(form.placeholderFullName).fill('M');
    await page.getByRole('button', { name: form.submitButton }).click();
    await expect(page.getByText(errors.nameTooShort.replace('{min}', '2'))).toBeVisible();
    expect(sent).toEqual([]);
  });

  test('sends a review with the keyboard and shows the success state (mocked API)', async ({ page }) => {
    const posted = await mockAddReview(page, 201, { _id: 'new', fullName: 'Maria Rossi' });
    await page.goto('/en/reviews');

    await page.getByLabel(form.placeholderFullName).focus();
    await page.keyboard.type('  Maria Rossi ');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(form.placeholderCountry)).toBeFocused();
    await page.keyboard.type('Rome, Italy');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(form.placeholderMessage)).toBeFocused();
    await page.keyboard.type('A blessed visit, thank you.');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: form.submitButton })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: form.successMessage })).toBeFocused();
    await expect(page.getByText(form.confirmationMessage)).toBeVisible();
    expect(posted).toEqual([{ fullName: 'Maria Rossi', email: 'Rome, Italy', msg: 'A blessed visit, thank you.' }]);

    await page.getByRole('button', { name: en.communityPage.reviews.form.another }).click();
    await expect(page.getByLabel(form.placeholderFullName)).toHaveValue('');
    await expect(page.getByLabel(form.placeholderFullName)).toBeFocused();
  });

  test('explains a rate limit and keeps the text (mocked 429)', async ({ page }) => {
    await mockAddReview(page, 429, { error: 'Too many requests, please try again later.' });
    await page.goto('/en/reviews');
    await fill(page);
    await page.getByRole('button', { name: form.submitButton }).click();
    await expect(alertIn(page)).toHaveText(errors.rateLimited);
    await expect(page.getByLabel(form.placeholderMessage)).toHaveValue('A blessed visit, thank you.');
  });

  test('explains a server error (mocked 500) and a network failure', async ({ page }) => {
    await mockAddReview(page, 500, { error: 'Internal server error' });
    await page.goto('/en/reviews');
    await fill(page);
    await page.getByRole('button', { name: form.submitButton }).click();
    await expect(alertIn(page)).toHaveText(errors.server);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route(ADD_REVIEW, (route) => route.abort());
    await page.getByRole('button', { name: form.submitButton }).click();
    await expect(alertIn(page)).toHaveText(errors.network);
  });
});

test.describe('live page', () => {
  const first = broadcasts.map((b) => ({ ...b, start: new Date(b.startsAt).getTime() })).sort((a, b) => a.start - b.start)[0];
  const status = en.communityPage.live.status;

  test('renders in English with the player and the past broadcasts', async ({ page }) => {
    await page.goto('/en/live');
    await expect(page).toHaveTitle(new RegExp(en.communityPage.live.metaTitle));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.communityPage.live.title);

    const expected = liveState(
      broadcasts.map((b) => ({ start: new Date(b.startsAt).getTime() })),
      Date.now(),
    ).status;
    await expect(page.getByRole('status')).toHaveText(status[expected]);

    const videos = page.locator('video');
    await expect(videos).toHaveCount(2);
    for (const video of await videos.all()) {
      await expect(video).toHaveAttribute('preload', 'none');
      await expect(video).toHaveAttribute('poster', /\/_next\/image\?url=/);
    }
    await expect(page.getByRole('heading', { name: en.videos.interview_nazareth.title })).toBeVisible();

    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
    expect(jsonLd['@graph'].filter((n: { '@type': string }) => n['@type'] === 'VideoObject')).toHaveLength(2);
  });

  test('renders right-to-left in Hebrew', async ({ page }) => {
    await page.goto('/he/live');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(he.communityPage.live.title);
    await expect(page.getByRole('heading', { name: he.live.past_live_events })).toBeVisible();
  });

  test('counts down, goes live and goes offline on the visitor clock', async ({ page }) => {
    test.skip(!first, 'no broadcast scheduled');
    await page.clock.install({ time: first.start - 65 * 60 * 1000 });
    await page.goto('/en/live');

    await expect(page.getByRole('status')).toHaveText(status.upcoming);
    await expect(page.getByRole('heading', { name: en.live.upcoming_event })).toBeVisible();
    // The unit labels are plural messages ("Minute" / "Minutes"), chosen by the number above them.
    await expect(page.getByRole('timer')).toContainText(/Minutes?/);
    await expect(page.getByRole('button', { name: en.live.join_live })).toBeDisabled();

    await page.clock.fastForward('01:06:00');
    await expect(page.getByRole('status')).toHaveText(status.live);
    const join = page.getByRole('link', { name: new RegExp(en.live.join_live) });
    await expect(join).toHaveAttribute('href', /instagram\.com/);
    await expect(join).toHaveAttribute('target', '_blank');

    await page.clock.fastForward(LIVE_WINDOW_MS);
    await expect(page.getByRole('status')).toHaveText(status.offline);
  });
});

test.describe('community pages', () => {
  for (const path of ['/en/reviews', '/he/reviews', '/en/live', '/he/live']) {
    test(`${path} has no serious accessibility violations`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  // Checks this page's own content: the shared site header (outside this port) is hidden first, since at
  // 360px its language button and menu button do not fit yet.
  for (const path of ['/en/reviews', '/he/reviews', '/en/live', '/he/live']) {
    test(`${path} content fits a 360px screen`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // (Set through the CSSOM: the page's Content-Security-Policy refuses an injected <style> element.)
      await page.evaluate(() => document.querySelector<HTMLElement>('body > header')?.style.setProperty('display', 'none', 'important'));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
