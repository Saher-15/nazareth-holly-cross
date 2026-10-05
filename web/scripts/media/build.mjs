// Builds the licensed Nazareth imagery (see docs/MEDIA.md).
//
//   node scripts/media/build.mjs            fetch metadata, download originals, write images + manifest
//   node scripts/media/build.mjs --offline  rebuild from the cached originals and cached metadata only
//   node scripts/media/build.mjs --verify   ask Commons again: is every file still there, with the same licence and author?
//                                           (downloads nothing, writes nothing; exits 1 on any difference)
//
// Input : scripts/media/sources.json (the curated list: Commons file, topic, subject, alt text, focal point)
// Output: public/images/nazareth-media/<id>/<width>.avif|webp (+ og.jpg), src/data/media.generated.ts
//
// Every file's licence is read from the Wikimedia Commons API and checked here; a file whose licence is not
// public domain, CC0, CC BY or CC BY-SA (any NC/ND/unknown) stops the build. Originals are only downloaded from
// upload.wikimedia.org and are kept outside the repository (MEDIA_CACHE, default ../.media-cache).
// sharp comes with Next.js (no extra dependency).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '../..');
const require = createRequire(path.join(webRoot, 'package.json'));
const sharp = require('sharp');

const OFFLINE = process.argv.includes('--offline');
const VERIFY = process.argv.includes('--verify');
const CACHE = path.resolve(process.env.MEDIA_CACHE ?? path.join(webRoot, '../.media-cache'));
const OUT = path.join(webRoot, 'public/images/nazareth-media');
const MANIFEST = path.join(webRoot, 'src/data/media.generated.ts');
const UA = 'NazarethHolyCrossSiteBot/1.0 (https://nazarethholycross.com; saher@topazengs.net)';

const WIDTHS = [640, 1280, 1920];
const HERO_WIDTHS = [640, 1280, 1920, 2560];
const AVIF = { quality: 52, effort: 4 };
const WEBP = { quality: 74, effort: 4 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) =>
  (s ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

// Licences accepted for a commercial site: public domain, CC0, CC BY, CC BY-SA. Anything else is refused.
const LICENSE_OK = /^(CC0( 1\.0)?|Public domain|PD[ -][\w.-]+|CC BY(-SA)? \d\.\d( \w+)?)$/i;
const LICENSE_BAD = /\b(NC|ND)\b|non-?commercial|no ?derivs|fair use|all rights reserved/i;

async function getJson(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`Request failed: ${url}`);
}

async function loadMetadata(files) {
  const cacheFile = path.join(CACHE, 'metadata.json');
  const cached = !VERIFY && fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  if (OFFLINE) return cached;
  const missing = files.filter((f) => !cached[f]);
  for (let i = 0; i < missing.length; i += 25) {
    const batch = missing.slice(i, i + 25);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      titles: batch.map((f) => `File:${f}`).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size|mime',
      origin: '*',
    });
    const json = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`);
    const titleOf = Object.fromEntries((json.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of Object.values(json.query.pages)) {
      const title = page.title.replace(/^File:/, '');
      const original = (titleOf[page.title] ?? page.title).replace(/^File:/, '');
      const info = page.imageinfo?.[0];
      if (!info) throw new Error(`Not found on Commons: ${title}`);
      const m = info.extmetadata ?? {};
      cached[original] = {
        url: info.url.split('?')[0],
        pageUrl: info.descriptionurl,
        mime: info.mime,
        width: info.width,
        height: info.height,
        license: strip(m.LicenseShortName?.value),
        licenseUrl: m.LicenseUrl?.value ?? '',
        artist: strip(m.Artist?.value),
        credit: strip(m.Credit?.value),
        attributionRequired: strip(m.AttributionRequired?.value),
        nonFree: strip(m.NonFree?.value),
        restrictions: strip(m.Restrictions?.value),
      };
    }
    await sleep(500);
  }
  if (!VERIFY) {
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 1));
  }
  return cached;
}

function checkLicense(file, meta) {
  const problems = [];
  if (!LICENSE_OK.test(meta.license) || LICENSE_BAD.test(meta.license)) problems.push(`licence "${meta.license}"`);
  if (meta.nonFree) problems.push('marked non-free');
  if (meta.mime !== 'image/jpeg') problems.push(`type ${meta.mime}`);
  const pd = /^(CC0|Public domain|PD)/i.test(meta.license);
  if (!pd && (!meta.artist || /^unknown/i.test(meta.artist))) problems.push('no named author');
  if (problems.length) throw new Error(`REFUSED ${file}: ${problems.join(', ')}`);
}

async function download(file, meta) {
  fs.mkdirSync(path.join(CACHE, 'originals'), { recursive: true });
  const dest = path.join(CACHE, 'originals', file);
  if (fs.existsSync(dest)) return dest;
  if (OFFLINE) throw new Error(`Missing cached original: ${file}`);
  if (!meta.url.startsWith('https://upload.wikimedia.org/')) throw new Error(`Refusing to download from ${meta.url}`);
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(meta.url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      await sleep(1200);
      return dest;
    }
    await sleep(4000 * (attempt + 1));
  }
  throw new Error(`Download failed: ${file}`);
}

const authorOf = (meta) => {
  const artist = meta.artist.replace(/\s*from\s+.*$/i, '').replace(/Unknown author(Unknown author)?/i, 'Unknown author');
  return artist.length > 60 ? artist.slice(0, 57).trimEnd() + '…' : artist;
};

async function render(src, source) {
  const dir = path.join(OUT, source.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const base = sharp(src, { failOn: 'none' }).rotate();
  const { width: fullW, height: fullH } = await sharp(await base.clone().toBuffer({ resolveWithObject: false })).metadata();
  const widths = (source.hero ? HERO_WIDTHS : WIDTHS).filter((w) => w <= fullW);
  if (!widths.length) throw new Error(`${source.id}: source is only ${fullW}px wide`);
  if (fullW < 1900) console.warn(`  note: ${source.id} is only ${fullW}px wide`);
  for (const w of widths) {
    const resized = () => base.clone().resize({ width: w, withoutEnlargement: true });
    await resized().avif(AVIF).toFile(path.join(dir, `${w}.avif`));
    await resized().webp(WEBP).toFile(path.join(dir, `${w}.webp`));
  }
  const top = widths[widths.length - 1];
  const topHeight = Math.round((fullH * top) / fullW);
  const blur = await base.clone().resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  let og = false;
  if (source.og) {
    await base
      .clone()
      .resize(1200, 630, { fit: 'cover', position: focalPosition(source.focal) })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(dir, 'og.jpg'));
    og = true;
  }
  return { widths, width: top, height: topHeight, blurDataURL: `data:image/webp;base64,${blur.toString('base64')}`, og };
}

// sharp positions a cover crop by a gravity keyword or an attention strategy; map the focal point to the nearest.
function focalPosition({ x, y }) {
  const col = x < 34 ? 'left' : x > 66 ? 'right' : '';
  const row = y < 34 ? 'top' : y > 66 ? 'bottom' : '';
  const word = `${row} ${col}`.trim();
  return word || 'centre';
}

// --verify: compare what Commons says today with the manifest the site was built from.
async function verify(sources, meta) {
  const manifest = fs.readFileSync(MANIFEST, 'utf8');
  const built = JSON.parse(manifest.slice(manifest.indexOf('= [') + 2, manifest.lastIndexOf(']') + 1));
  const problems = [];
  for (const source of sources) {
    const m = meta[source.file];
    try {
      if (!m) throw new Error('missing on Commons');
      checkLicense(source.file, m);
      const entry = built.find((item) => item.id === source.id);
      if (!entry) throw new Error('not in the manifest (run the build)');
      if (entry.license !== m.license) throw new Error(`licence changed: ${entry.license} -> ${m.license}`);
      if (entry.author !== authorOf(m)) throw new Error(`author changed: ${entry.author} -> ${authorOf(m)}`);
    } catch (error) {
      problems.push(`${source.id}: ${error.message}`);
    }
  }
  if (problems.length) {
    console.error([`${problems.length} problem(s):`, ...problems.map((p) => `  ${p}`)].join('\n'));
    process.exit(1);
  }
  console.log(`${sources.length} images verified against Wikimedia Commons: licence and author unchanged.`);
}

async function main() {
  const sources = JSON.parse(fs.readFileSync(path.join(here, 'sources.json'), 'utf8'));
  const ids = new Set();
  for (const s of sources) {
    if (ids.has(s.id)) throw new Error(`Duplicate id ${s.id}`);
    ids.add(s.id);
  }
  const meta = await loadMetadata(sources.map((s) => s.file));
  if (VERIFY) return verify(sources, meta);
  const items = [];
  for (const source of sources) {
    const m = meta[source.file];
    if (!m) throw new Error(`No metadata for ${source.file}`);
    checkLicense(source.file, m);
    const author = authorOf(m);
    const pd = /^(CC0|Public domain|PD)/i.test(m.license);
    console.log(`${source.id}  (${m.license}, ${author})`);
    const original = await download(source.file, m);
    const out = await render(original, source);
    items.push({
      id: source.id,
      topic: source.topic,
      subject: source.subject,
      alt: source.alt,
      width: out.width,
      height: out.height,
      widths: out.widths,
      blurDataURL: out.blurDataURL,
      focal: { x: source.focal[0], y: source.focal[1] },
      og: out.og,
      credit: pd ? `${author}, ${m.license}, via Wikimedia Commons` : `${author} / Wikimedia Commons, ${m.license}`,
      author,
      license: m.license,
      licenseUrl: m.licenseUrl,
      sourceUrl: m.pageUrl,
      file: source.file,
    });
  }
  const body = JSON.stringify(items, null, 2);
  fs.writeFileSync(
    MANIFEST,
    `// GENERATED by scripts/media/build.mjs from scripts/media/sources.json. Do not edit by hand (see docs/MEDIA.md).\n` +
      `import type { MediaItem } from './media-types';\n\n` +
      `export const MEDIA_ITEMS: readonly MediaItem[] = ${body};\n`,
  );
  console.log(`\n${items.length} images, manifest written to ${path.relative(webRoot, MANIFEST)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
