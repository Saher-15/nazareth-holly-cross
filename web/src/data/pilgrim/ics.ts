// A minimal iCalendar (.ics, RFC 5545) writer, shared by the pilgrimage planner and the Christian calendar of /live.
// Three kinds of event:
//  - the planner's itinerary items: "floating" times (no time zone), so a calendar shows 09:00 as 09:00 wherever the
//    pilgrim is, which is what a printed itinerary means;
//  - a feast: an all-day event on its calendar date (DTSTART;VALUE=DATE), the same day in every time zone;
//  - a live broadcast: an exact instant in UTC (…Z), which every calendar shows in its owner's own time.

type IcsCommon = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  geo?: { lat: number; lng: number };
  /** A page about the event (absolute address). */
  url?: string;
};

/** An itinerary item at local ("floating") times. */
export type IcsTimedEvent = IcsCommon & {
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** Minutes after midnight. */
  start: number;
  end: number;
};

/** A whole day (or several), YYYY-MM-DD. */
export type IcsAllDayEvent = IcsCommon & { allDay: true; date: string; days?: number };

/** An exact instant, in milliseconds since the epoch. */
export type IcsInstantEvent = IcsCommon & { startsAt: number; endsAt: number };

export type IcsEvent = IcsTimedEvent | IcsAllDayEvent | IcsInstantEvent;

/** Escapes text values (RFC 5545 section 3.3.11). */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

/** Folds a content line to at most 75 octets, continuation lines starting with one space (RFC 5545 3.1). */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // The first line holds 75 octets; the next ones 74 because of the leading space.
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-11-02` and 570 minutes -> `20261102T093000`. */
export function icsLocal(date: string, minutes: number): string {
  const [y, m, d] = date.split('-').map(Number);
  // Date.UTC rolls over past midnight, so an event ending at 24:30 lands on the next day correctly.
  const at = new Date(Date.UTC(y, m - 1, d, 0, minutes));
  return `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}00`;
}

/** `2026-03-25` -> `20260325` (a DATE value). */
export function icsDate(date: string): string {
  return date.replace(/-/g, '');
}

/** An instant as a UTC DATE-TIME: `20261020T163000Z`. */
export function icsUtc(at: Date | number): string {
  const d = typeof at === 'number' ? new Date(at) : at;
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Adds `days` to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

function timing(event: IcsEvent): string[] {
  if ('allDay' in event) {
    return [`DTSTART;VALUE=DATE:${icsDate(event.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(event.date, event.days ?? 1))}`, 'TRANSP:TRANSPARENT'];
  }
  if ('startsAt' in event) return [`DTSTART:${icsUtc(event.startsAt)}`, `DTEND:${icsUtc(event.endsAt)}`];
  return [`DTSTART:${icsLocal(event.date, event.start)}`, `DTEND:${icsLocal(event.date, event.end)}`];
}

export function buildIcs(
  events: readonly IcsEvent[],
  { name, now = new Date(), product = 'Pilgrimage planner' }: { name: string; now?: Date; product?: string },
): string {
  const stamp = icsUtc(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Nazareth Holy Cross//${product}//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(name)}`,
  ];
  for (const event of events) {
    lines.push('BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${stamp}`, ...timing(event), `SUMMARY:${escapeIcsText(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.geo) lines.push(`GEO:${event.geo.lat.toFixed(6)};${event.geo.lng.toFixed(6)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/** Hands an .ics text to the browser as a file to save or open (made in the page: nothing is sent anywhere). */
export function saveIcsFile(ics: string, fileName: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
