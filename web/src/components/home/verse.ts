// Verse of the day: the same verse for every visitor on the same calendar day in
// Nazareth, rotating daily through the verses in messages (home.v1..v6 / home.r1..r6).

export const VERSE_COUNT = 6;
export const NAZARETH_TIME_ZONE = 'Asia/Jerusalem';

const DAY_MS = 86_400_000;

/** The calendar date (YYYY-MM-DD) in Nazareth at the given instant. */
export function nazarethDate(now: Date, timeZone: string = NAZARETH_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Which verse (1-based) belongs to a calendar date (YYYY-MM-DD). */
export function verseNumberFor(isoDate: string, count: number = VERSE_COUNT): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  return (((dayNumber % count) + count) % count) + 1;
}
