// Re-encodes the site's videos for the web (see docs/PERFORMANCE.md, "Video"). Needs ffmpeg with libx264 and libsvtav1.
//   FFMPEG=<path to ffmpeg> node scripts/video/encode.mjs <sources folder> <output folder> [hero|live|interview|tour ...]
// Sources come from scripts/video/fetch-sources.mjs. Nothing is written into the repository except what you point
// the output folder at: only files under 8 MB belong in public/videos, the larger ones go to Firebase Storage.
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const [src, out, ...only] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node scripts/video/encode.mjs <sources> <output> [hero|live|interview|tour ...]');
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

const JOBS = {
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
  for (const [file, args] of JOBS[name] ?? []) {
    // -i is inside args: the input path is resolved against the sources folder.
    const i = args.indexOf('-i');
    const resolved = [...args];
    resolved[i + 1] = join(src, args[i + 1]);
    const target = join(out, file);
    const started = Date.now();
    const run = spawnSync(FFMPEG, ['-v', 'error', '-y', ...resolved, target], { stdio: 'inherit' });
    if (run.status !== 0) throw new Error(`ffmpeg failed for ${file}`);
    console.log(`${file}: ${(statSync(target).size / 1048576).toFixed(1)} MB in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
}
