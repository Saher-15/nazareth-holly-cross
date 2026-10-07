// Re-encodes the site's videos for the web (see docs/PERFORMANCE.md, "Video"). Needs ffmpeg with libx264 and libsvtav1.
//   FFMPEG=<path to ffmpeg> node scripts/video/encode.mjs <sources folder> <output folder> [hero|heroTour|live|interview|tour ...]
// Sources come from scripts/video/fetch-sources.mjs (heroTour reads tour-720p.mp4, the output of the tour job). Nothing
// is written into the repository except what you point the output folder at: only the two hero films belong in
// public/videos (the 16 s loop, and the background cut of the whole tour in parts), the large ones go to Firebase Storage.
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const [src, out, ...only] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node scripts/video/encode.mjs <sources> <output> [hero|heroTour|live|interview|tour ...]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const x264 = (crf, extra = []) => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', ...extra];
const av1 = (crf, preset = 6) => ['-c:v', 'libsvtav1', '-crf', String(crf), '-preset', String(preset), '-pix_fmt', 'yuv420p', '-g', '120'];
const aac = (kbps) => ['-c:a', 'aac', '-b:a', `${kbps}k`, '-ac', '2'];
const opus = (kbps) => ['-c:a', 'libopus', '-b:a', `${kbps}k`, '-ac', '2'];
const FAST = ['-movflags', '+faststart'];

// The home hero: the first 16 s of the aerial film, silent, upscaled from 640x360 with a light sharpen.
// (The original is 4 minutes long, with sound nobody hears, and 21 MB.)
const HERO_VF = 'scale=1280:720:flags=lanczos,unsharp=5:5:0.5:5:5:0.0';

// The home hero's background film: the whole virtual tour, silent, for a background only (docs/PERFORMANCE.md).
//   - cut out of the frame: the burned-in subtitles (bottom) and the logo (top left), keeping 16:9 (1024x576 of 1280x720)
//   - the end card (black, with the address) is left out: the film stops at 523.4 s, just before it fades to black
//   - 1.5x faster (8 min 43 s become 5 min 49 s) so the file stays small; still the whole tour, in order
//   - 960x540, 25 fps, a keyframe every 2 s, a light denoise and slightly less contrast (it sits under a dark veil)
//   - H.264 only, in two passes at an average of 460 kbit/s: 20.1 MB, plays everywhere. An AV1 copy was measured and
//     left out: at 300 kbit/s it came out at 10.7 MB but visibly softer (VMAF 64.8 against 74.2 on a busy minute); at
//     the same look it would be about 14 MB, a second large file in the repository to save visitors about 30%.
//   - cut, without re-encoding, into twelve parts of 30 s (hero-tour-00.mp4 ... hero-tour-11.mp4, each with its index
//     first): a browser buffers about a minute ahead of one long file (3.1 MB in the first 3 seconds was measured), while the
//     hero plays the parts one after the other and holds at most two (components/home/HeroVideo.tsx).
//   - the nine white place-name cards the tour shows at the lower left ("Mary's Well", "Pilgrims' Street" ...) are painted
//     out while they are on screen (ffmpeg delogo, which fills the box from its edges): the crop would otherwise cut them
//     in half ("'s Well"). Found by a scan for white boxes with dark text, checked frame by frame: [from s, to s, x, y, w, h]
//     in the 1280x720 source.
const TOUR_LABELS = [
  [11.0, 15.6, 100, 448, 316, 84],
  [29.0, 34.0, 40, 356, 682, 140],
  [119.4, 126.8, 100, 446, 366, 86],
  [158.4, 168.2, 100, 440, 690, 96],
  [176.6, 179.6, 100, 448, 486, 84],
  [228.4, 237.2, 100, 448, 452, 84],
  [253.4, 260.4, 100, 446, 446, 90],
  [285.6, 289.4, 100, 440, 656, 96],
  [432.2, 437.8, 100, 440, 470, 96],
];
const DELOGO = TOUR_LABELS.map(([from, to, x, y, w, h]) => `delogo=x=${x}:y=${y}:w=${w}:h=${h}:enable='between(t,${from},${to})'`).join(',');
const TOUR_VF = `${DELOGO},crop=1024:576:192:0,setpts=PTS/1.5,fps=25,scale=960:540:flags=lanczos,hqdn3d=1.5:1.5:3:3,eq=contrast=0.94:brightness=-0.02,format=yuv420p`;
const TOUR_IN = ['-t', '523.4', '-i', 'tour-720p.mp4', '-an', '-vf', TOUR_VF];
const GOP = ['-g', '50', '-keyint_min', '50', '-sc_threshold', '0'];
const tourX264 = ['-c:v', 'libx264', '-preset', 'veryslow', '-profile:v', 'high', '-level:v', '3.1', '-b:v', '460k', '-maxrate', '920k', '-bufsize', '1840k', ...GOP];
const NULL_OUT = process.platform === 'win32' ? 'NUL' : '/dev/null';
// The two-pass statistics and the whole film are made outside the output folder; only the parts land there.
const WORK = join(tmpdir(), 'nhc-hero-tour');
mkdirSync(WORK, { recursive: true });
const PASSLOG = join(WORK, 'hero-tour-2pass');
const WHOLE = join(WORK, 'hero-tour-540.mp4');

const JOBS = {
  heroTour: [
    // two passes: the first only measures (its output is thrown away), the second writes the whole film
    [NULL_OUT, [...TOUR_IN, ...tourX264, '-pass', '1', '-passlogfile', PASSLOG, '-f', 'mp4'], { raw: true }],
    [WHOLE, [...TOUR_IN, ...tourX264, '-pass', '2', '-passlogfile', PASSLOG, ...FAST], { raw: true }],
    // then the parts, copied (no second encode): a keyframe every 2 s makes every cut fall exactly on 30 s
    [
      join(out, 'hero-tour-%02d.mp4'),
      ['-i', WHOLE, '-map', '0:v', '-c', 'copy', '-f', 'segment', '-segment_time', '30', '-reset_timestamps', '1', '-segment_format_options', 'movflags=+faststart'],
      { raw: true },
    ],
  ],
  hero: [
    ['hero-loop.mp4', ['-t', '16', '-i', 'video-7.mp4', '-an', '-vf', HERO_VF, ...x264(29, ['-maxrate', '1400k', '-bufsize', '2800k']), ...FAST]],
    ['hero-loop.webm', ['-t', '16', '-i', 'video-7.mp4', '-an', '-vf', HERO_VF, ...av1(42)]],
  ],
  live: [
    ['live-17-9-24.mp4', ['-i', 'live-17-9-24.mp4', ...x264(31), ...aac(64), ...FAST]],
    ['live-17-9-24.webm', ['-i', 'live-17-9-24.mp4', ...av1(46), ...opus(48)]],
  ],
  interview: [
    ['interview.mp4', ['-i', 'interview.mp4', ...x264(28), ...aac(80), ...FAST]],
    ['interview.webm', ['-i', 'interview.mp4', ...av1(40), ...opus(64)]],
  ],
  // The 9-minute 1080p tour: too big for the repository whatever the codec (an AV1 version was tried: at a similar
  // look it came out larger than H.264, so there is none). Upload these to Firebase Storage.
  tour: [
    ['tour-1080p.mp4', ['-i', 'tour.mp4', '-vf', 'scale=1920:1080', ...x264(25, ['-maxrate', '4000k', '-bufsize', '8000k']), ...aac(128), ...FAST]],
    ['tour-720p.mp4', ['-i', 'tour.mp4', '-vf', 'scale=1280:720', ...x264(26, ['-maxrate', '1800k', '-bufsize', '3600k']), ...aac(96), ...FAST]],
  ],
};

for (const name of only.length ? only : Object.keys(JOBS)) {
  for (const [file, args, { raw = false } = {}] of JOBS[name] ?? []) {
    // -i is inside args: the input path is resolved against the sources folder.
    const i = args.indexOf('-i');
    const resolved = [...args];
    if (!isAbsolute(args[i + 1])) resolved[i + 1] = join(src, args[i + 1]);
    // `raw`: the output is not a file in the output folder (the first pass of a two-pass encode writes to NUL).
    const target = raw ? file : join(out, file);
    const started = Date.now();
    const run = spawnSync(FFMPEG, ['-v', 'error', '-y', ...resolved, target], { stdio: 'inherit' });
    if (run.status !== 0) throw new Error(`ffmpeg failed for ${file}`);
    const size = raw ? 'done' : `${(statSync(target).size / 1048576).toFixed(1)} MB`;
    console.log(`${raw ? `${name} step` : file}: ${size} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
}
rmSync(WORK, { recursive: true, force: true });
