// The symbolic "light a flame" counter of the candle strip. It lives in this browser
// only (localStorage) and starts again every day; nothing is sent anywhere.

export const FLAMES_KEY = 'hx-flames'; // same key as the previous site, so counts carry over
export const MAX_CANDLES_SHOWN = 9;

/** The visitor's local calendar date, YYYY-MM-DD. */
export function localDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Today's count from a stored value; anything unreadable or from another day counts as 0. */
export function parseFlames(raw: string | null, today: string): number {
  if (!raw) return 0;
  try {
    const saved: unknown = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      const { day, count } = saved as { day?: unknown; count?: unknown };
      if (day === today && Number.isInteger(count) && (count as number) >= 0) return count as number;
    }
  } catch {
    // corrupt value: start again
  }
  return 0;
}

export function serializeFlames(count: number, today: string): string {
  return JSON.stringify({ day: today, count });
}
