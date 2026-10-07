import { OBJECT_ID, PLAYER_URL } from './liveStatus';
import { apiText, apiTime, isRecord, itemsOf, readInBrowser } from './liveSchedule';
import { dateLocale, NAZARETH_TIME_ZONE } from './time';

// Recordings of past live broadcasts (docs/LIVE.md): GET /live/recordings answers
//   { items: [{ id, title, date (ISO, the day of the live), durationSeconds, thumbnailUrl, playbackUrl }] }
// (published and ready, newest first, at most 50). Read on the server for the HTML and the structured data and once
// more in the browser when /live opens. Only Cloudflare Stream addresses of the exact expected shape are kept: the
// poster (img-src https://*.cloudflarestream.com) and the player page (frame-src); any other item is dropped.

/** Cloudflare Stream's poster of a stored video: https://customer-<code>.cloudflarestream.com/<32 hex>/thumbnails/thumbnail.jpg */
export const THUMBNAIL_URL = /^https:\/\/customer-[a-z0-9]{1,64}\.cloudflarestream\.com\/[a-f0-9]{32}\/thumbnails\/thumbnail\.jpg$/;

export type Recording = {
  id: string;
  /** Decoded text: render it as text only. */
  title: string;
  /** The day of the broadcast, milliseconds since the epoch (null: unknown). */
  date: number | null;
  /** 0 when unknown. */
  durationSeconds: number;
  thumbnailUrl: string;
  playbackUrl: string;
};

/** GET /live/recordings -> the published recordings, newest broadcast first. */
export function parseRecordings(json: unknown): Recording[] {
  const items = itemsOf(json).flatMap((raw): Recording[] => {
    if (!isRecord(raw)) return [];
    const id = typeof raw.id === 'string' && OBJECT_ID.test(raw.id) ? raw.id : null;
    const title = apiText(raw.title, 400);
    const { thumbnailUrl, playbackUrl, durationSeconds } = raw;
    if (!id || !title) return [];
    if (typeof thumbnailUrl !== 'string' || !THUMBNAIL_URL.test(thumbnailUrl)) return [];
    if (typeof playbackUrl !== 'string' || !PLAYER_URL.test(playbackUrl)) return [];
    const seconds = typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : 0;
    return [{ id, title, date: apiTime(raw.date), durationSeconds: Math.min(Math.max(seconds, 0), 7 * 86_400), thumbnailUrl, playbackUrl }];
  });
  return items.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}

export const fetchRecordingsInBrowser = (fetchImpl?: typeof fetch) => readInBrowser('/live/recordings', parseRecordings, fetchImpl);

/** A recording with its day and length already written in the page language (for the server's HTML). */
export type RecordingView = Recording & { dateLabel: string | null; durationLabel: string | null };

/** The labels of a recording: the same function on the server and in the browser. */
export function recordingView(recording: Recording, locale: string): RecordingView {
  return {
    ...recording,
    dateLabel: recording.date === null ? null : formatRecordingDate(recording.date, locale),
    durationLabel: formatDuration(recording.durationSeconds, locale),
  };
}

/** The day in Nazareth as YYYY-MM-DD (for <time datetime>). */
export function nazarethDay(date: number): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: NAZARETH_TIME_ZONE }).format(date);
}

/** The day of a recorded broadcast in Nazareth time, in the page language: "6 October 2026". */
export function formatRecordingDate(date: number, locale: string): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: 'long', timeZone: NAZARETH_TIME_ZONE, numberingSystem: 'latn' }).format(date);
}

/** "45 min", "1 hr 5 min": the language's own short units, joined the way it joins units; null when unknown. */
export function formatDuration(seconds: number, locale: string): string | null {
  if (!(seconds > 0)) return null;
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const unit = (value: number, name: 'hour' | 'minute') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'short', numberingSystem: 'latn' }).format(value);
  const parts = [...(hours ? [unit(hours, 'hour')] : []), ...(minutes || !hours ? [unit(minutes, 'minute')] : [])];
  return new Intl.ListFormat(locale, { type: 'unit', style: 'narrow' }).format(parts);
}

/** ISO 8601 duration (structured data, <time datetime>): 3905 -> "PT1H5M5S". */
export function isoDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (!total) return 'PT0S';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s ? `${s}S` : ''}`;
}
