// Formatting for the "Today in Nazareth" strip, shared by the server render and the client clocks.
// Every date and time is Nazareth's (Asia/Jerusalem) and written with Western digits in every language.

import { dateLocale, NAZARETH_TIME_ZONE } from '@/lib/time';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "14:32" or "2:32 PM", as the language writes a time of day, in Nazareth. */
export function formatClock(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { hour: 'numeric', minute: '2-digit', timeZone: NAZARETH_TIME_ZONE, numberingSystem: 'latn' }).format(ms);
}

/** "14:32" for the datetime attribute of <time> (a time of day in Nazareth). */
export function clockAttribute(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: NAZARETH_TIME_ZONE }).format(ms);
}

/** "Wednesday 7 October", the day in Nazareth. */
export function formatDay(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { weekday: 'long', day: 'numeric', month: 'long', timeZone: NAZARETH_TIME_ZONE, numberingSystem: 'latn' }).format(ms);
}

/** A calendar day given as "YYYY-MM-DD" (a feast), e.g. "Thursday 25 December". */
export function formatCalendarDay(isoDate: string, locale: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(dateLocale(locale), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC', numberingSystem: 'latn' }).format(Date.UTC(y, m - 1, d));
}

/** "tomorrow", "in 79 days", in the page language. */
export function formatInDays(days: number, locale: string): string {
  // (numberingSystem as a locale extension: TypeScript's RelativeTimeFormat options do not list it yet)
  return new Intl.RelativeTimeFormat(`${locale}-u-nu-latn`, { numeric: 'auto' }).format(days, 'day');
}

/** The start of a broadcast: "Sun 12 Oct, 10:00", in Nazareth. */
export function formatStart(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(dateLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: NAZARETH_TIME_ZONE,
    numberingSystem: 'latn',
  }).format(ms);
}

/**
 * A remaining time in its two largest units, rounded down to the minute, as the language writes it ("2 days 4 hours",
 * "3 hours 12 minutes", "8 minutes"). Built from Intl's unit names and list rules, so every language gets its own
 * plural forms. Never seconds: the strip changes once a minute at most.
 */
export function formatDuration(ms: number, locale: string): string {
  const total = Math.max(0, Math.floor(ms / MINUTE));
  const days = Math.floor(total / (DAY / MINUTE));
  const hours = Math.floor((total % (DAY / MINUTE)) / 60);
  const minutes = total % 60;
  const parts: [number, 'day' | 'hour' | 'minute'][] =
    days > 0 ? [[days, 'day'], [hours, 'hour']] : hours > 0 ? [[hours, 'hour'], [minutes, 'minute']] : [[minutes, 'minute']];
  const words = parts
    .filter(([value], i) => i === 0 || value > 0)
    .map(([value, unit]) => new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long', numberingSystem: 'latn' }).format(value));
  return new Intl.ListFormat(locale, { type: 'unit', style: 'long' }).format(words);
}
