import { API_URL } from './config';

// The sales funnel, counted without cookies (docs/ANALYTICS.md; the API side is server/services/metrics.js).
//
// The page tells our own API that a step happened: the candle page was opened, the order button was pressed, the
// details were filled in, a payment was started, a payment was completed. The API adds one to an anonymous daily
// counter. With it goes the campaign of the visit: the utm_source, utm_medium and utm_campaign of the link the
// visitor arrived by, read once from the address bar and kept IN MEMORY only (it survives moving between pages, it
// is gone when the tab reloads or closes).
//
// What this never does: set a cookie, write to localStorage or sessionStorage, create a visitor identifier, send
// anything to a third party, or send anything that describes the visitor. So no consent banner is needed for it.
// It also stays silent when the visitor asked not to be tracked (Global Privacy Control or Do Not Track), and under
// browser automation (tests, crawlers).

export type TrackFlow = 'candle' | 'order' | 'donation';
export type TrackEvent = 'view' | 'cta' | 'details' | 'pay_start' | 'paid';
export type Campaign = { source: string; medium: string; campaign: string };

let campaign: Campaign | null = null;

const label = (value: string | null) => (value ?? '').trim().slice(0, 60);

/** The campaign of a link (?utm_source=...&utm_medium=...&utm_campaign=...), or null when it carries none. */
export function campaignFrom(search: string): Campaign | null {
  const params = new URLSearchParams(search);
  const found = { source: label(params.get('utm_source')), medium: label(params.get('utm_medium')), campaign: label(params.get('utm_campaign')) };
  return found.source || found.medium || found.campaign ? found : null;
}

/** Reads the campaign of this visit from the address bar, once (the first page of the visit). */
export function rememberCampaign(search: string = typeof window === 'undefined' ? '' : window.location.search) {
  if (campaign === null) campaign = campaignFrom(search) ?? { source: '', medium: '', campaign: '' };
  return campaign;
}

/** For tests: forgets the campaign. */
export function resetCampaign() {
  campaign = null;
}

/** Did the visitor ask not to be tracked, or is this not a person's browser? */
export function trackingSilenced(nav: Navigator = navigator): boolean {
  const n = nav as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null; webdriver?: boolean };
  return n.globalPrivacyControl === true || n.doNotTrack === '1' || n.webdriver === true;
}

/** Counts one step. Never throws, never waits, and the answer is never read. */
export function track(flow: TrackFlow, event: TrackEvent) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  try {
    if (trackingSilenced()) return;
    const body = JSON.stringify({ flow, event, ...rememberCampaign() });
    // keepalive: the request survives the page being left (the "paid" step is followed by a change of screen).
    void fetch(`${API_URL}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }).catch(() => {});
  } catch {
    // counting must never break the page
  }
}
