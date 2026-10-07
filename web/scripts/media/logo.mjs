// Builds the header logo (the round brand medallion of <SiteHeader>) from the master logo.
//
//   node scripts/media/logo.mjs        (from web/)
//
// Input : public/images/logo.webp (1024 x 1024, the emblem on its own navy ground, no transparency)
// Output: public/images/brand/logo-<size>.avif|webp at 48, 96 and 144 px (1x, 2x, 3x of the 48px medallion)
//
// The emblem (cross, halo, candle, church, the name in an arc) fills about x 155-885 and y 75-950 of the square. The
// header shows it in a circle, so the square is cropped around the emblem's centre with a radius that keeps the cross,
// the candle and the church whole; CSS rounds the corners (border-radius: 50%). The files stay opaque: the logo's own
// navy ground is the medallion's face. Never upscaled (the crop is 940 px; the largest output is 144 px).
// sharp comes with Next.js (no extra dependency), as in scripts/media/build.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '../..');
const require = createRequire(path.join(webRoot, 'package.json'));
const sharp = require('sharp');

const SRC = path.join(webRoot, 'public/images/logo.webp');
const OUT = path.join(webRoot, 'public/images/brand');
const LOGO_SIZES = [48, 96, 144];
// Centre of the emblem and the side of the square around it (in px of the 1024 px master).
const CROP = { left: 50, top: 35, width: 940, height: 940 };

const meta = await sharp(SRC).metadata();
if (meta.width < CROP.left + CROP.width || meta.height < CROP.top + CROP.height) {
  throw new Error(`The master logo is ${meta.width} x ${meta.height}: too small for the crop, refusing to upscale.`);
}
fs.mkdirSync(OUT, { recursive: true });
for (const size of LOGO_SIZES) {
  // A light sharpening after the big reduction keeps the cross and the flame crisp at 46px on a 1x screen.
  const base = sharp(SRC).extract(CROP).resize(size, size, { kernel: 'lanczos3' }).sharpen({ sigma: size < 96 ? 0.6 : 0.8 });
  await base.clone().avif({ quality: 68, effort: 6 }).toFile(path.join(OUT, `logo-${size}.avif`));
  await base.clone().webp({ quality: 86, effort: 6 }).toFile(path.join(OUT, `logo-${size}.webp`));
}
for (const file of fs.readdirSync(OUT).sort()) {
  console.log(`${file.padEnd(16)} ${fs.statSync(path.join(OUT, file)).size} bytes`);
}
