import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignFrom, rememberCampaign, resetCampaign, track, trackingSilenced } from '@/lib/track';
import { API_URL } from '@/lib/config';

// The cookie-free funnel count (docs/ANALYTICS.md): what is sent, where the campaign comes from, and the cases in
// which nothing is sent at all.

const nav = (over: object) => ({ globalPrivacyControl: false, doNotTrack: null, webdriver: false, ...over }) as unknown as Navigator;
const allow = (over: object = {}) => {
  for (const [key, value] of Object.entries({ globalPrivacyControl: false, doNotTrack: null, webdriver: false, ...over })) {
    Object.defineProperty(window.navigator, key, { configurable: true, writable: true, value });
  }
};
let fetcher: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetCampaign();
  allow();
  fetcher = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  allow({ globalPrivacyControl: true }); // back to the silent default of the unit tests (tests/unit/setup.ts)
  document.cookie.split(';').forEach((c) => expect(c.trim()).toBe(''));
});

describe('the campaign of a visit', () => {
  it('is read from the utm parameters of the link', () => {
    expect(campaignFrom('?utm_source=facebook&utm_medium=paid&utm_campaign=easter-2027&fbclid=abc')).toEqual({ source: 'facebook', medium: 'paid', campaign: 'easter-2027' });
    expect(campaignFrom('?utm_source=newsletter')).toEqual({ source: 'newsletter', medium: '', campaign: '' });
    expect(campaignFrom('?page=2')).toBeNull();
    expect(campaignFrom('')).toBeNull();
    expect(campaignFrom(`?utm_campaign=${'x'.repeat(200)}`)?.campaign).toHaveLength(60);
  });

  it('is remembered from the first page only, in memory', () => {
    expect(rememberCampaign('?utm_source=google&utm_campaign=candles')).toEqual({ source: 'google', medium: '', campaign: 'candles' });
    // a later page without the parameters, or with others, does not change it
    expect(rememberCampaign('')).toEqual({ source: 'google', medium: '', campaign: 'candles' });
    expect(rememberCampaign('?utm_source=other')).toEqual({ source: 'google', medium: '', campaign: 'candles' });
    resetCampaign();
    expect(rememberCampaign('')).toEqual({ source: '', medium: '', campaign: '' });
  });
});

describe('track', () => {
  it('sends the step and the campaign to our own API, and nothing else', () => {
    rememberCampaign('?utm_source=facebook&utm_medium=paid&utm_campaign=oct');
    track('candle', 'cta');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_URL}/track`);
    expect(JSON.parse(init.body as string)).toEqual({ flow: 'candle', event: 'cta', source: 'facebook', medium: 'paid', campaign: 'oct' });
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('stores nothing in the browser: no cookie, no localStorage, no sessionStorage', () => {
    localStorage.clear();
    sessionStorage.clear();
    rememberCampaign('?utm_source=facebook');
    track('candle', 'view');
    track('candle', 'paid');
    expect(document.cookie).toBe('');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('is silent when the visitor asked not to be tracked, and under automation', () => {
    expect(trackingSilenced(nav({}))).toBe(false);
    expect(trackingSilenced(nav({ globalPrivacyControl: true }))).toBe(true);
    expect(trackingSilenced(nav({ doNotTrack: '1' }))).toBe(true);
    expect(trackingSilenced(nav({ webdriver: true }))).toBe(true);
    for (const over of [{ globalPrivacyControl: true }, { doNotTrack: '1' }, { webdriver: true }]) {
      allow(over);
      track('candle', 'view');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('never breaks the page: a failing or missing network is swallowed', async () => {
    fetcher.mockRejectedValue(new Error('offline'));
    expect(() => track('order', 'pay_start')).not.toThrow();
    fetcher.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => track('order', 'paid')).not.toThrow();
    await Promise.resolve();
  });
});
