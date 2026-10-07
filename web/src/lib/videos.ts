// The site's videos and where each one is served from (see docs/PERFORMANCE.md, "Video").
//
// Small ones are re-encoded and live in public/videos (AV1 in WebM first, H.264 in MP4 as the fallback every
// browser plays). The long ones are too big for the repository: they stay on Firebase Storage until the
// re-encoded files from docs/PERFORMANCE.md are uploaded, then only the addresses below change.

export type VideoSource = { src: string; type: string };

const FIREBASE = 'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2F';

const av1 = (src: string): VideoSource => ({ src, type: 'video/webm; codecs="av01.0.05M.08,opus"' });
const av1Silent = (src: string): VideoSource => ({ src, type: 'video/webm; codecs="av01.0.05M.08"' });
const h264 = (src: string): VideoSource => ({ src, type: 'video/mp4' });

/**
 * The home hero's film: the whole virtual tour as a silent background (960x540 H.264, 5 min 49 s at 1.5x, 20.1 MB in
 * all), cut into 30-second parts that play one after the other. A browser buffers far ahead of a single long file
 * (3.1 MB in the first 3 seconds and 6.0 MB after 30 were measured, against 1.4 and 3.0 MB in parts); with parts it holds at most the one playing and the next.
 */
export const HERO_TOUR_PARTS: readonly string[] = Array.from({ length: 12 }, (_, i) => `/videos/hero-tour-${String(i).padStart(2, '0')}.mp4`);
/** H.264 High profile, level 3.1 (scripts/video/encode.mjs): a browser that has MP4 but not this codec gets the loop. */
export const HERO_TOUR_TYPE = 'video/mp4; codecs="avc1.64001F"';

/** The previous hero film, kept as the fallback: 16 s of the aerial film, silent, 1280x720, about 2 MB. */
export const HERO_VIDEO: readonly VideoSource[] = [av1Silent('/videos/hero-loop.webm'), h264('/videos/hero-loop.mp4')];

/** The 9-minute virtual tour (1080p, 811 MB as uploaded; the 1080p re-encode is about 200 MB). */
export const TOUR_VIDEO: readonly VideoSource[] = [
  h264(`${FIREBASE}tour.mp4?alt=media&token=af5c1463-2e97-4ae3-b205-a7566f45f9be`),
];

/** The recording of the live prayer of 17 September 2024 (6 MB, was 13 MB). */
export const LIVE_PRAYER_VIDEO: readonly VideoSource[] = [
  av1('/videos/live-17-9-24.webm'),
  h264('/videos/live-17-9-24.mp4'),
];

/** The interview (69 MB as uploaded; the re-encode is about 40 MB, too big for the repository). */
export const INTERVIEW_VIDEO: readonly VideoSource[] = [
  h264(`${FIREBASE}interview.mp4?alt=media&token=8465ecc1-614f-4080-acc6-1113f1623ea6`),
];

/** The address search engines get as `contentUrl`: the MP4 (it plays everywhere). */
export const contentUrl = (sources: readonly VideoSource[], siteUrl: string): string => {
  const mp4 = sources.find((s) => s.type === 'video/mp4') ?? sources[0];
  return mp4.src.startsWith('/') ? `${siteUrl}${mp4.src}` : mp4.src;
};
