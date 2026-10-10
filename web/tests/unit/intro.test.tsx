import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OpeningDoor from '@/components/home/OpeningDoor';
import { INTRO_ATTRIBUTE, INTRO_OVERLAY_ATTRIBUTE, INTRO_PREPAINT, INTRO_STORAGE_KEY, INTRO_VALUE } from '@/lib/intro';
import messages from '@/messages/en.json';

vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const en = (await import('@/messages/en.json')).default;
  return { getTranslations: async (namespace: string) => createTranslator({ locale: 'en', messages: en, namespace: namespace as never }) };
});

// The opening of the site (lib/intro.ts): the pre-paint script shows the door only on the first page of a visit when
// that page is the home page, never for reduced motion or automation; the same script ends it when the overlay's
// fade ends (natural or skipped by any input), or after a fallback delay.

const root = () => document.documentElement;
const runPrepaint = () => new Function(INTRO_PREPAINT)();
const visit = (path: string) => window.history.replaceState(null, '', path);
let reduced = false;
let webdriver = false;

beforeEach(() => {
  vi.useFakeTimers(); // the script's fallback timer must not fire in a later test
  sessionStorage.clear();
  root().removeAttribute(INTRO_ATTRIBUTE);
  root().removeAttribute('data-a11y-motion');
  reduced = false;
  webdriver = false;
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query.includes('reduce'), media: query }));
  Object.defineProperty(window.navigator, 'webdriver', { configurable: true, get: () => webdriver });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the intro pre-paint script', () => {
  it.each(['/en', '/he/', '/ar'])('opens the door on the first page of a visit when it is the home page (%s)', (path) => {
    visit(path);
    runPrepaint();
    expect(root().getAttribute(INTRO_ATTRIBUTE)).toBe(INTRO_VALUE);
    expect(sessionStorage.getItem(INTRO_STORAGE_KEY)).toBe('1');
  });

  it('shows it once per visit: a second home page load in the same tab has no door', () => {
    visit('/en');
    runPrepaint();
    root().removeAttribute(INTRO_ATTRIBUTE);
    runPrepaint();
    expect(root().hasAttribute(INTRO_ATTRIBUTE)).toBe(false);
  });

  it('a visit that starts on another page never shows it, even when the home page comes next', () => {
    for (const path of ['/en/shop', '/he/sites/latin', '/en/tour', '/xx']) {
      sessionStorage.clear();
      visit(path);
      runPrepaint();
      expect(root().hasAttribute(INTRO_ATTRIBUTE)).toBe(false);
      visit('/en');
      runPrepaint();
      expect(root().hasAttribute(INTRO_ATTRIBUTE)).toBe(false);
    }
  });

  it('never for reduced motion (the system setting or the accessibility panel) or automation', () => {
    visit('/en');
    reduced = true;
    runPrepaint();
    expect(root().hasAttribute(INTRO_ATTRIBUTE)).toBe(false);

    sessionStorage.clear();
    reduced = false;
    root().setAttribute('data-a11y-motion', 'reduce');
    runPrepaint();
    expect(root().hasAttribute(INTRO_ATTRIBUTE)).toBe(false);

    sessionStorage.clear();
    root().removeAttribute('data-a11y-motion');
    webdriver = true;
    runPrepaint();
    expect(root().hasAttribute(INTRO_ATTRIBUTE)).toBe(false);
  });

  it('does not throw when storage is blocked (and then shows nothing)', () => {
    visit('/en');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(runPrepaint).not.toThrow();
    expect(root().hasAttribute(INTRO_ATTRIBUTE)).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('the door', () => {
  const renderDoor = async () => render(await OpeningDoor());

  it('greets in the visitor’s language and is hidden from screen readers', async () => {
    await renderDoor();
    const door = screen.getByTestId('opening-door');
    expect(door).toHaveAttribute('aria-hidden', 'true');
    expect(door).toHaveAttribute(INTRO_OVERLAY_ATTRIBUTE);
    expect(door).toHaveTextContent(messages.home.intro.welcome);
    expect(door).toHaveTextContent(messages.home.intro.tagline);
  });

  it('ends when the overlay’s own fade ends, not when a door leaf or the light finishes', async () => {
    visit('/en');
    runPrepaint();
    await renderDoor();
    const door = screen.getByTestId('opening-door');
    fireEvent.animationEnd(door.firstElementChild as Element);
    expect(root().getAttribute(INTRO_ATTRIBUTE)).toBe(INTRO_VALUE);
    fireEvent.animationEnd(door);
    expect(root().hasAttribute(INTRO_ATTRIBUTE)).toBe(false);
  });

  it('any key, click or scroll skips it with a short fade, before the page hydrates', async () => {
    for (const input of [() => fireEvent.keyDown(window, { key: 'Escape' }), () => fireEvent.pointerDown(window), () => fireEvent.wheel(window)]) {
      sessionStorage.clear();
      root().removeAttribute(INTRO_ATTRIBUTE);
      visit('/en');
      runPrepaint();
      input();
      expect(root().getAttribute(INTRO_ATTRIBUTE)).toBe('skip');
    }
  });

  it('ends by itself even if no animation event comes', () => {
    visit('/en');
    runPrepaint();
    vi.advanceTimersByTime(6000);
    expect(root().hasAttribute(INTRO_ATTRIBUTE)).toBe(false);
  });

  it('an input on a page without the door changes nothing', () => {
    visit('/en/shop');
    runPrepaint();
    fireEvent.pointerDown(window);
    expect(root().hasAttribute(INTRO_ATTRIBUTE)).toBe(false);
  });
});
