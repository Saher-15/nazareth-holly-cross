// Recordings of past broadcasts shown under the live player. Titles and descriptions reuse the
// existing `videos.*` messages; the posters live in public/images.
import { INTERVIEW_VIDEO, LIVE_PRAYER_VIDEO, type VideoSource } from '@/lib/videos';

export type PastBroadcast = {
  id: string;
  messageKey: 'interview_nazareth' | 'live_prayer_latin';
  /** The files of the recording, best first (WebM before MP4); a browser plays the first it understands. */
  sources: readonly VideoSource[];
  poster: { src: string; width: number; height: number };
  /** Day it was streamed (YYYY-MM-DD), when known. Used for structured data. */
  recordedOn?: string;
};

export const pastBroadcasts: readonly PastBroadcast[] = [
  {
    id: 'interview-nazareth',
    messageKey: 'interview_nazareth',
    sources: INTERVIEW_VIDEO,
    poster: { src: '/images/interview.jpg', width: 518, height: 445 },
  },
  {
    id: 'live-prayer-latin',
    messageKey: 'live_prayer_latin',
    sources: LIVE_PRAYER_VIDEO,
    poster: { src: '/images/live-17-9-24.jpg', width: 1054, height: 1600 },
    recordedOn: '2024-09-17',
  },
];
