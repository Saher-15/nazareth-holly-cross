// One-off generator for the app icons from public/images/logo.webp (run from web/: node tests/qa/make-icons.mjs).
// Writes src/app/icon.png (192), src/app/apple-icon.png (180) and src/app/favicon.ico (PNG-in-ICO, 48px).
import fs from 'node:fs';
import sharp from 'sharp';

const src = 'public/images/logo.webp';
// The emblem fills x 155-885, y 75-950 of the 1024px square; crop to it so it stays readable at 16-32px.
const crop = { left: 80, top: 60, width: 870, height: 870 };
const square = (size) => sharp(src).extract(crop).resize(size, size).png({ compressionLevel: 9, palette: true, quality: 85 });

fs.writeFileSync('src/app/icon.png', await square(192).toBuffer());
fs.writeFileSync('src/app/apple-icon.png', await square(180).toBuffer());

const png = await sharp(src).extract(crop).resize(48, 48).ensureAlpha().png({ compressionLevel: 9 }).toBuffer(); // RGBA: the bundler refuses palette PNGs inside an .ico
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header[6] = 48; // width
header[7] = 48; // height
header.writeUInt16LE(1, 10); // planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18); // offset of the image data
fs.writeFileSync('src/app/favicon.ico', Buffer.concat([header, png]));
console.log('icons written');
