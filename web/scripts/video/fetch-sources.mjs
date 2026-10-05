// Downloads the owner's original videos from their public Firebase URLs into a working folder (never into the repo).
//   node scripts/video/fetch-sources.mjs <folder> [name ...]
// Names: hero (video-7), live, interview, tour. Skips files that are already complete.
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BUCKET = 'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2F';
export const SOURCES = {
  hero: { file: 'video-7.mp4', url: `${BUCKET}video-7.mp4?alt=media&token=b0173721-21a1-46d0-b15b-f2001b912e72` },
  live: { file: 'live-17-9-24.mp4', url: `${BUCKET}live-17-9-24.mp4?alt=media&token=9bbb1fe2-4439-497c-adf6-038697cde4e0` },
  interview: { file: 'interview.mp4', url: `${BUCKET}interview.mp4?alt=media&token=8465ecc1-614f-4080-acc6-1113f1623ea6` },
  tour: { file: 'tour.mp4', url: `${BUCKET}tour.mp4?alt=media&token=af5c1463-2e97-4ae3-b205-a7566f45f9be` },
};

const [dir, ...names] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node scripts/video/fetch-sources.mjs <folder> [hero|live|interview|tour ...]');
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
for (const name of names.length ? names : Object.keys(SOURCES)) {
  const source = SOURCES[name];
  if (!source) throw new Error(`unknown video: ${name}`);
  const target = join(dir, source.file);
  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const size = Number(res.headers.get('content-length') ?? 0);
  if (existsSync(target) && statSync(target).size === size) {
    console.log(`${name}: already complete`);
    await res.body?.cancel();
    continue;
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
  console.log(`${name}: ${(statSync(target).size / 1048576).toFixed(1)} MB`);
}
