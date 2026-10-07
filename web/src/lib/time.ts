/** Dates and times of the site are Nazareth's, wherever the visitor is (broadcasts, the verse of the day). */
export const NAZARETH_TIME_ZONE = 'Asia/Jerusalem';

/** How long a broadcast is assumed to last, for "add to calendar" and the structured data (the API does not say).
 *  Here (a module without zod) because the calendar on /live uses it in the browser; lib/broadcastSchedule.ts
 *  re-exports it. */
export const BROADCAST_DURATION_MS = 60 * 60 * 1000;
