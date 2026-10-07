import { codeOfEnglishName } from '@/components/checkout/countries';
import { api, type Prayer, type Product, type Review } from '@/lib/api';

// Data for the home page, read on the server. A slow or failing API must never
// break the page: each loader gives up after a few seconds and returns a fallback.

export const FEATURED_COUNT = 8;
export const MAX_VOICES = 8;
const TIMEOUT_MS = 10_000;

// One short line in the server log, not a full validation dump.
function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(/\r?\n/)[0].slice(0, 200);
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type Featured = { ok: true; products: Product[] } | { ok: false };

export async function loadFeatured(
  fetcher: () => Promise<Product[]> = () => api.products(1, FEATURED_COUNT),
  timeoutMs: number = TIMEOUT_MS,
): Promise<Featured> {
  try {
    const products = await withTimeout(fetcher(), timeoutMs);
    return { ok: true, products: products.slice(0, FEATURED_COUNT) };
  } catch (error) {
    console.error('[home] featured souvenirs unavailable:', describe(error));
    return { ok: false };
  }
}

/** Reviews to show as pilgrim voices; an empty list hides the section. */
export async function loadVoices(
  fetcher: () => Promise<Review[]> = api.reviews,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Review[]> {
  try {
    const reviews = await withTimeout(fetcher(), timeoutMs);
    return reviews.filter((r) => r.msg.trim() && r.fullName.trim()).slice(0, MAX_VOICES);
  } catch (error) {
    console.error('[home] pilgrim voices unavailable:', describe(error));
    return [];
  }
}

export const NEWEST_PRAYERS = 3;
/** How many of the newest prayers are read to count their countries (the most the API gives in one page). */
export const PRAYER_SAMPLE = 50;

export type PrayerWall = {
  /** Every prayer on the wall (the API's count). */
  total: number;
  /** The newest few, to show. */
  newest: Prayer[];
  /** How many prayers the country count is based on (the newest PRAYER_SAMPLE, or all of them when there are fewer). */
  sample: number;
  /** Different countries among those (only countries the prayer form knows: free text of older prayers is not guessed). */
  countries: number;
};

/** The prayer wall in figures, from one read of its newest page; null hides the section (empty wall, API down). */
export async function loadPrayerWall(
  fetcher: () => Promise<{ prayers: Prayer[]; total: number }> = () => api.prayers(1, PRAYER_SAMPLE),
  timeoutMs: number = TIMEOUT_MS,
): Promise<PrayerWall | null> {
  try {
    const { prayers, total } = await withTimeout(fetcher(), timeoutMs);
    const shown = prayers.filter((p) => p.prayer.trim());
    if (total === 0 || shown.length === 0) return null;
    const countries = new Set(prayers.map((p) => codeOfEnglishName(p.country.trim())).filter(Boolean));
    return { total, newest: shown.slice(0, NEWEST_PRAYERS), sample: prayers.length, countries: countries.size };
  } catch (error) {
    console.error('[home] prayer wall unavailable:', describe(error));
    return null;
  }
}

/** Shortens a long text at a word boundary and adds an ellipsis. */
export function clip(text: string, max = 220): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
