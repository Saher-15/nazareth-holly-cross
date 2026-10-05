// Contact sheet of licensed photos, to choose placements by eye.
//   node scripts/media/sheet.mjs <out.jpg> <id> [id ...]
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const [out, ...ids] = process.argv.slice(2);
const root = new URL('../../public/images/nazareth-media/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const W = 400;
const H = 260;
const cols = 4;
const tiles = [];
for (const id of ids) {
  const width = readdirSync(join(root, id)).filter((f) => f.endsWith('.webp')).map((f) => parseInt(f, 10)).sort((a, b) => a - b)[0];
  const buf = await sharp(join(root, id, `${width}.webp`)).resize(W, H, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
  const label = Buffer.from(`<svg width="${W}" height="22"><rect width="100%" height="100%" fill="#000"/><text x="6" y="16" font-size="14" fill="#fff" font-family="Arial">${id}</text></svg>`);
  tiles.push({ id, input: await sharp(buf).composite([{ input: label, gravity: 'south' }]).jpeg().toBuffer() });
}
const rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#111' } })
  .composite(tiles.map((t, i) => ({ input: t.input, left: (i % cols) * W, top: Math.floor(i / cols) * H })))
  .jpeg({ quality: 82 })
  .toFile(out);
console.log('wrote', out);
