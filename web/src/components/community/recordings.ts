// Recordings of past broadcasts shown under the live player. Titles and descriptions reuse the
// existing `videos.*` messages; the posters live in public/images.
export type PastBroadcast = {
  id: string;
  messageKey: 'interview_nazareth' | 'live_prayer_latin';
  src: string;
  poster: { src: string; width: number; height: number };
  /** Day it was streamed (YYYY-MM-DD), when known. Used for structured data. */
  recordedOn?: string;
};

export const pastBroadcasts: readonly PastBroadcast[] = [
  {
    id: 'interview-nazareth',
    messageKey: 'interview_nazareth',
    src: 'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Finterview.mp4?alt=media&token=8465ecc1-614f-4080-acc6-1113f1623ea6',
    poster: { src: '/images/interview.jpg', width: 518, height: 445 },
  },
  {
    id: 'live-prayer-latin',
    messageKey: 'live_prayer_latin',
    src: 'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Flive-17-9-24.mp4?alt=media&token=9bbb1fe2-4439-497c-adf6-038697cde4e0',
    poster: { src: '/images/live-17-9-24.jpg', width: 1054, height: 1600 },
    recordedOn: '2024-09-17',
  },
];
