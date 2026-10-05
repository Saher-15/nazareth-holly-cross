// Audit of every photo in public/images: format, pixel size, weight, and a flag when the file is too small to be
// sharp as a wide picture. The generated licensed set (images/nazareth-media) is summarised, not listed.
//   node scripts/media/audit.mjs [--markdown]
import { createRequire } from 'node:module';
import { readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const ROOT = fileURLToPath(new URL('../../public/images/', import.meta.url));
const markdown = process.argv.includes('--markdown');

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'nazareth-media') yield* walk(path);
    } else if (/\.(jpe?g|png|webp|avif|gif)$/i.test(entry.name)) yield path;
  }
}

const rows = [];
for (const file of walk(ROOT)) {
  const meta = await sharp(file).metadata();
  const portrait = (meta.orientation ?? 1) >= 5;
  const width = portrait ? meta.height : meta.width;
  const height = portrait ? meta.width : meta.height;
  rows.push({ file: relative(ROOT, file).replaceAll('\\', '/'), format: extname(file).slice(1), width, height, kb: Math.round(statSync(file).size / 1024) });
}
rows.sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }));

// A photo shown across a phone (412 css px at 2.6x) or a laptop needs about 1280 px of width to be sharp; under
// 900 px it is soft whenever it covers the width of the screen.
const flag = (r) => (r.width < 900 && r.height < 900 ? 'small' : r.width < 1280 && r.width >= r.height ? 'soft as a wide picture' : '');
if (markdown) {
  console.log('| file | format | pixels | kB | note |\n|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.file} | ${r.format} | ${r.width}x${r.height} | ${r.kb} | ${flag(r)} |`);
} else {
  for (const r of rows) console.log(`${r.file.padEnd(28)} ${r.format.padEnd(5)} ${`${r.width}x${r.height}`.padEnd(11)} ${String(r.kb).padStart(6)} kB  ${flag(r)}`);
}
const total = rows.reduce((n, r) => n + r.kb, 0);
console.log(`\n${rows.length} files, ${(total / 1024).toFixed(1)} MB; ${rows.filter((r) => flag(r)).length} flagged`);
