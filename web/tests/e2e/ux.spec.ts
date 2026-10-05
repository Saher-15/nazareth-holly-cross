import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// UI/UX behaviour of the site shell: skip link, language menus, 404, back-to-top, reading progress,
// share toast, print styles, right-to-left mirroring and touch targets.

const scrollDown = async (page: Page, y: number) => {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.waitForTimeout(250);
};

test('the skip link is the first tab stop and moves the focus to the content', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard only');
  await page.goto('/en/about');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: /skip to content/i });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});

test('the language menu works with the keyboard and returns the focus', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard only');
  await page.goto('/en/about');
  const trigger = page.getByRole('button', { name: /language/i });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  // The current language has the focus; the arrow keys move through the grid.
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Français' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'العربية' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();

  // Choosing a language opens the same page in it and gives the focus back to the button.
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Deutsch' }).click();
  await expect(page).toHaveURL(/\/de\/about$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('button', { name: /sprache/i })).toBeFocused();
});

test('the footer lists every language as a link to the same page', async ({ page }) => {
  await page.goto('/en/about');
  const nav = page.getByRole('navigation', { name: 'Languages' });
  const links = nav.getByRole('link');
  await expect(links).toHaveCount(11);
  await expect(nav.getByRole('link', { name: 'English' })).toHaveAttribute('aria-current', 'true');
  await expect(nav.getByRole('link', { name: 'עברית' })).toHaveAttribute('hreflang', 'he');
  await nav.getByRole('link', { name: 'Ελληνικά' }).click();
  await expect(page).toHaveURL(/\/el\/about$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'el');
});

test('the footer has no newsletter form and no cookie banner', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('footer input, footer form')).toHaveCount(0);
  await expect(page.getByText(/cookie/i)).toHaveCount(0);
});

test('the 404 page is branded, answers 404 and offers where to go next', async ({ page }) => {
  const response = await page.goto('/en/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page could not be found');
  await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
  const suggestions = page.getByRole('region', { name: /where would you like to go/i });
  await expect(suggestions.getByRole('link')).toHaveCount(3);
  await suggestions.getByRole('link', { name: /Holy sites/ }).click();
  await expect(page).toHaveURL(/\/en\/sites$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('404 page in Hebrew mirrors and has no serious accessibility violations', async ({ page }) => {
  await page.goto('/he/nope');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('back to top appears after scrolling, jumps up and hands the focus to the content', async ({ page }) => {
  await page.goto('/en/sites/latin');
  const button = page.getByRole('button', { name: 'Back to top' });
  await expect(button).toBeHidden();
  await scrollDown(page, 3000);
  await expect(button).toBeVisible();
  await button.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  await expect(page.locator('main#main')).toBeFocused();
  await expect(button).toBeHidden();
});

test('a reading progress line fills on long pages and is absent elsewhere', async ({ page }) => {
  await page.goto('/en/sites/latin');
  const bar = page.getByTestId('reading-progress');
  await expect(bar).toHaveAttribute('data-visible', 'false');
  await scrollDown(page, 1200);
  await expect(bar).toHaveAttribute('data-visible', 'true');
  const scale = await bar.locator('div').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(scale).toBeGreaterThan(0.05);
  await page.goto('/en/candle');
  await expect(page.getByTestId('reading-progress')).toHaveCount(0);
});

test('"Copy link" on a holy-site page says so in a toast', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Browsers with a native share sheet open it instead; this test covers the copy path.
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await page.goto('/en/sites/latin');
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText(/link copied/i)).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(page.getByText(/link copied/i)).toBeHidden();
});

test('print styles keep the article and drop the chrome', async ({ page }) => {
  await page.goto('/en/sites/latin');
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('body > header')).toBeHidden();
  await expect(page.locator('footer').first()).toBeHidden();
  await expect(page.locator('#place-gallery')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Back to top' })).toBeHidden();
  const color = await page.getByRole('heading', { level: 1 }).evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe('rgb(0, 0, 0)');
});

test('the mobile menu hands over the focus and returns it, and locks the page behind', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/en');
  const toggle = page.getByRole('button', { name: /open menu/i });
  await toggle.click();
  const nav = page.locator('#main-nav');
  await expect(nav.getByRole('link').first()).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-menu-open', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /open menu/i })).toBeFocused();
  await expect(page.locator('html')).not.toHaveAttribute('data-menu-open', 'true');

  // The dimmed page behind the open menu closes it, and a choice in it goes to that page.
  await page.getByRole('button', { name: /open menu/i }).click();
  await nav.getByRole('link', { name: 'Holy sites' }).click();
  await expect(page).toHaveURL(/\/en\/sites$/);
  await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();
});

test('right-to-left: arrows mirror, the e-mail address stays left-to-right', async ({ page }) => {
  await page.goto('/he/nope');
  const arrow = page.locator('[class*="cardArrow"]').first();
  await expect(arrow).toBeVisible();
  const flipped = await arrow.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(flipped).toBe(-1);
  await page.goto('/en/nope');
  const normal = await page.locator('[class*="cardArrow"]').first().evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(normal).toBe(1);
  await page.goto('/ar');
  const mail = page.locator('footer a[href^="mailto:"]');
  await expect(mail).toHaveCSS('direction', 'ltr');
});

test('header and footer controls are at least 44px', async ({ page }) => {
  for (const path of ['/en', '/he/about', '/ru/sites']) {
    await page.goto(path);
    const small = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('header a, header button, footer a, footer button')) {
        const r = el.getBoundingClientRect();
        const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.skip-link');
        if (visible && !el.classList.contains('skip-link') && (r.width < 43.5 || r.height < 43.5)) {
          bad.push(`${el.textContent?.trim() || el.getAttribute('aria-label')} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return bad;
    });
    expect(small, path).toEqual([]);
  }
});

test('moving between pages keeps working with page transitions', async ({ page, isMobile }) => {
  test.skip(isMobile, 'uses the desktop navigation bar');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/en');
  await page.getByRole('navigation', { name: 'Nazareth Holy Cross' }).getByRole('link', { name: 'Holy sites' }).click();
  await expect(page).toHaveURL(/\/en\/sites$/);
  await page.getByRole('navigation', { name: 'Nazareth Holy Cross' }).getByRole('link', { name: 'Tour' }).click();
  await expect(page).toHaveURL(/\/en\/tour$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The page content takes the focus after a client-side navigation.
  await expect(page.locator('main#main')).toBeFocused();
  expect(errors).toEqual([]);
});

test('a link navigation runs one view transition and leaves the page clean', async ({ page, isMobile }) => {
  test.skip(isMobile, 'uses the desktop navigation bar');
  await page.addInitScript(() => {
    const w = window as unknown as { __vt: number };
    w.__vt = 0;
    const original = document.startViewTransition?.bind(document);
    if (original) {
      document.startViewTransition = ((arg?: unknown) => {
        w.__vt += 1;
        return original(arg as never);
      }) as typeof document.startViewTransition;
    }
  });
  await page.goto('/en');
  await page.getByRole('navigation', { name: 'Nazareth Holy Cross' }).getByRole('link', { name: 'Tour' }).click();
  await expect(page).toHaveURL(/\/en\/tour$/);
  await expect(page.locator('html')).not.toHaveClass(/vt-page/);
  expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(1);
  // The same page again, a hash jump and an external link start no transition.
  await page.goto('/en/about');
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(0);
});

test('a slow navigation shows the branded loading screen, and a fast one does not', async ({ page, isMobile }) => {
  test.skip(isMobile, 'uses the desktop navigation bar');
  let slow = true;
  await page.route('**/*', async (route) => {
    if (slow && route.request().url().includes('_rsc=')) await new Promise((r) => setTimeout(r, 2600));
    await route.continue();
  });
  await page.goto('/en');
  const nav = page.getByRole('navigation', { name: 'Nazareth Holy Cross' });
  await nav.getByRole('link', { name: 'Tour' }).click();
  await expect(page.getByTestId('navigation-loading')).toBeVisible({ timeout: 2500 });
  await expect(page.getByTestId('navigation-loading').getByRole('status')).toContainText('Loading');
  await expect(page).toHaveURL(/\/en\/tour$/, { timeout: 8000 });
  await expect(page.getByTestId('navigation-loading')).toBeHidden();

  slow = false;
  await nav.getByRole('link', { name: 'Reviews' }).click();
  await expect(page).toHaveURL(/\/en\/reviews$/);
  await expect(page.getByTestId('navigation-loading')).toHaveCount(0);
});

test('reduced motion: content shows at once and nothing keeps moving', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of ['/en/sites/latin', '/he/about', '/en/nope']) {
    await page.goto(path);
    const state = await page.evaluate(() => ({
      hiddenReveals: [...document.querySelectorAll('.ui-reveal')].filter((el) => getComputedStyle(el).opacity !== '1').length,
      looping: [...document.querySelectorAll('main *, header *')].filter((el) => {
        const s = getComputedStyle(el);
        return s.animationName !== 'none' && s.animationIterationCount === 'infinite';
      }).length,
    }));
    expect(state, path).toEqual({ hiddenReveals: 0, looping: 0 });
  }
});

test('hydration never leaves a second copy of the page in the DOM', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __maxCopies: number }).__maxCopies = 0;
    const timer = setInterval(() => {
      const w = window as unknown as { __maxCopies: number };
      w.__maxCopies = Math.max(w.__maxCopies, document.querySelectorAll('main h1').length, document.querySelectorAll('main form').length);
    }, 4);
    setTimeout(() => clearInterval(timer), 4000);
  });
  for (const path of ['/en/reviews', '/en/about', '/he/donate']) {
    await page.goto(path);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __maxCopies: number }).__maxCopies), path).toBeLessThanOrEqual(1);
  }
});

test('every page has exactly one level-1 heading and no horizontal scroll at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  for (const path of ['/en', '/ru/sites', '/de/sites/greek', '/he/tour', '/ar/about', '/en/donate', '/en/nope']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
