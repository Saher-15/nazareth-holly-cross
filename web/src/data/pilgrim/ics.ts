// A minimal iCalendar (.ics, RFC 5545) writer for the pilgrimage planner. Times are "floating" (no time zone),
// so a calendar shows 09:00 as 09:00 wherever the pilgrim is, which is what a printed itinerary means.

export type IcsEvent = {
  uid: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** Minutes after midnight. */
  start: number;
  end: number;
  summary: string;
  description?: string;
  location?: string;
  geo?: { lat: number; lng: number };
};

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

const icsUtcStamp = (now: Date) =>
  `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

/** Adds `days` to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

export function buildIcs(events: readonly IcsEvent[], { name, now = new Date() }: { name: string; now?: Date }): string {
  const stamp = icsUtcStamp(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nazareth Holy Cross//Pilgrimage planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(name)}`,
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsLocal(event.date, event.start)}`,
      `DTEND:${icsLocal(event.date, event.end)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.geo) lines.push(`GEO:${event.geo.lat.toFixed(6)};${event.geo.lng.toFixed(6)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}
