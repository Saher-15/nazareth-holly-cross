import { addDays, addMonths, civilDateIn, daysInMonth, toIsoDate, weekday, type IsoDate } from '@/lib/liturgical';
import type { CalendarBroadcast } from '@/lib/broadcastSchedule';
import { NAZARETH_TIME_ZONE } from '@/lib/time';

// The month grid of the Christian calendar (components/calendar/LiturgicalCalendar.tsx): which day sits in which cell,
// the first day of the week per language, and what each key does. Pure, so it is unit-tested without a browser.

/**
 * The first day of the week (0 = Sunday, 1 = Monday, 6 = Saturday), as the Unicode CLDR gives it for the country each
 * language points to (en -> United States, pt -> Brazil, he -> Israel, ar -> Egypt; the European languages ->
 * Monday). Written out, not read from Intl.Locale's week info: not every browser has it, and the server and the
 * browser must draw the same grid.
 */
const WEEK_START: Readonly<Record<string, number>> = { en: 0, pt: 0, he: 0, ar: 6 };
export const weekStartFor = (locale: string): number => WEEK_START[locale] ?? 1;

/** The weekdays (0 = Sunday ... 6 = Saturday) in the order of the grid's columns. */
export const weekdayColumns = (weekStart: number): number[] => Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);

/** The weeks of a month, each 7 cells long: a date, or null for a cell of the month before or after. */
export function monthWeeks(year: number, month: number, weekStart: number): (IsoDate | null)[][] {
  const first = toIsoDate({ year, month, day: 1 });
  const lead = (weekday(first) - weekStart + 7) % 7;
  const total = daysInMonth(year, month);
  const cells: (IsoDate | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: total }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/**
 * Where a key moves the focus in the grid (the WAI-ARIA grid and date-picker patterns), or null for a key the grid
 * does not handle. Left and Right follow the screen, so in Hebrew and Arabic (columns right to left) Left goes to the
 * next day. Home and End go to the first and last day of the week, Page Up / Page Down to the same day a month
 * earlier or later (with Shift: a year).
 */
export function moveByKey(date: IsoDate, key: string, { rtl, weekStart, shift = false }: { rtl: boolean; weekStart: number; shift?: boolean }): IsoDate | null {
  const column = (weekday(date) - weekStart + 7) % 7;
  switch (key) {
    case 'ArrowRight':
      return addDays(date, rtl ? -1 : 1);
    case 'ArrowLeft':
      return addDays(date, rtl ? 1 : -1);
    case 'ArrowDown':
      return addDays(date, 7);
    case 'ArrowUp':
      return addDays(date, -7);
    case 'Home':
      return addDays(date, -column);
    case 'End':
      return addDays(date, 6 - column);
    case 'PageUp':
      return addMonths(date, shift ? -12 : -1);
    case 'PageDown':
      return addMonths(date, shift ? 12 : 1);
    default:
      return null;
  }
}

/** The calendar day of each broadcast in Nazareth, where the site's dates live. */
export function broadcastsByDay(broadcasts: readonly CalendarBroadcast[]): Map<IsoDate, CalendarBroadcast[]> {
  const days = new Map<IsoDate, CalendarBroadcast[]>();
  for (const broadcast of broadcasts) {
    const day = civilDateIn(broadcast.start, NAZARETH_TIME_ZONE);
    days.set(day, [...(days.get(day) ?? []), broadcast]);
  }
  return days;
}
