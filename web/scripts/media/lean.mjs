// Lean copies of the photos that sit under a dark gradient and a headline (the home hero): the same photo at
// 1280 / 1920 / 2560 px, but compressed harder (AVIF quality 38, WebP 52), because a heavy scrim hides what the extra
// bytes buy. A visitor on a slow phone gets about half the bytes of the normal files at the same sharpness of shape.
//   node scripts/media/lean.mjs <id> [id ...]      writes public/images/nazareth-media/<id>/lean-<width>.{avif,webp}
// The normal files (build.mjs) are the source. Rerun after `npm run media:build` changes a photo.
import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = fileURLToPath(new URL('../../public/images/nazareth-media/', import.meta.url));
export const LEAN_WIDTHS = [1280, 1920, 2560];

for (const id of process.argv.slice(2)) {
  const source = LEAN_WIDTHS.map((w) => join(ROOT, id, `${w}.webp`)).reverse().find(existsSync);
  if (!source) throw new Error(`no 2560/1920/1280 WebP for ${id}`);
  for (const width of LEAN_WIDTHS) {
    if (!existsSync(join(ROOT, id, `${width}.webp`))) continue;
    const base = sharp(source).resize({ width, withoutEnlargement: true });
    const avif = join(ROOT, id, `lean-${width}.avif`);
    const webp = join(ROOT, id, `lean-${width}.webp`);
    await base.clone().avif({ quality: 38, effort: 6, chromaSubsampling: '4:2:0' }).toFile(avif);
    await base.clone().webp({ quality: 52, effort: 5 }).toFile(webp);
    console.log(`${id} ${width}: avif ${(statSync(avif).size / 1024).toFixed(0)} kB, webp ${(statSync(webp).size / 1024).toFixed(0)} kB`);
  }
}
