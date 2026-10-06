// Backs up the whole database to a dated folder of gzipped NDJSON files, with a manifest of counts and SHA-256s.
//
//   cd server
//   node scripts/backup.js --out D:\NHC-Backups
//
// Result:  <out>/nhc-backup-20261006-231500/
//              manifest.json                what was backed up: per collection the file, document count, size, SHA-256
//                                           of the file and the collection's indexes
//              order.ndjson.gz              one MongoDB Extended JSON document per line (exact types: ObjectId,
//              candle.ndjson.gz ...         dates, numbers), gzipped. One file per collection.
//
// READ-ONLY: it only reads (find) and counts; nothing in the database is written, changed or locked. It reads every
// collection (no collection is skipped), so the backup also contains the admin accounts (password hashes, encrypted
// two-factor secrets) and the audit log: keep the folder as private as the database itself (docs/BACKUP.md).
//
// The folder is written as ".partial" and renamed only when every file has been written and re-read and checked
// against the manifest, so a backup that looks complete is complete. The exit code is 0 only then.
//
// The database address comes from DATABASEURL (environment or server/.env) or a hidden prompt, never from an
// argument; only the host and database name are printed, never the address.

import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StringDecoder } from 'node:string_decoder';
import zlib from 'node:zlib';
import mongoose from 'mongoose';
import { askHidden } from './create-admin.js';
import { isMain, openDatabase, readArgs, readDatabaseUrl, stamp } from './lib/cli.js';
import { actualIndexes, normaliseActual } from '../services/indexes.js';

const { EJSON } = mongoose.mongo.BSON; // the driver's own Extended JSON (no extra dependency)

export const FORMAT = 1;
export const MANIFEST = 'manifest.json';
export const FOLDER_PREFIX = 'nhc-backup-';

// Extended JSON in "canonical" mode keeps every BSON type exactly (a number stays an int32/double/long, a date a date).
export const toLine = (doc) => `${EJSON.stringify(doc, { relaxed: false })}\n`;
export const fromLine = (line) => EJSON.parse(line, { relaxed: false });

// Streams the gzipped file of one collection and returns { documents, bytes, sha256 } measured on what was written.
async function writeCollection(cursor, file) {
  const hash = crypto.createHash('sha256');
  let documents = 0;
  let bytes = 0;
  async function* lines() {
    for await (const doc of cursor) {
      const line = toLine(doc);
      bytes += Buffer.byteLength(line);
      documents += 1;
      yield line;
    }
  }
  const measure = new Transform({ transform(chunk, _encoding, done) { hash.update(chunk); done(null, chunk); } });
  // pipeline: backpressure is honoured and an error anywhere stops everything and closes the file.
  await pipeline(Readable.from(lines()), zlib.createGzip({ level: 6 }), measure, fs.createWriteStream(file, { flags: 'wx' })); // wx: never overwrites
  return { documents, bytes, sha256: hash.digest('hex') };
}

// Reads a backup file back: { documents, sha256 } of the compressed bytes, and calls onDocument(doc) for each line
// when given. Used by the post-backup check here and by restore.js. A damaged file throws.
export async function readCollection(file, onDocument) {
  const hash = crypto.createHash('sha256');
  const measure = new Transform({ transform(chunk, _encoding, done) { hash.update(chunk); done(null, chunk); } });
  let documents = 0;
  const take = async (text) => {
    if (!text) return;
    const doc = fromLine(text); // a damaged line throws here
    documents += 1;
    if (onDocument) await onDocument(doc);
  };
  await pipeline(fs.createReadStream(file), measure, zlib.createGunzip(), async (chunks) => {
    const decoder = new StringDecoder('utf8');
    let tail = '';
    for await (const chunk of chunks) {
      const parts = (tail + decoder.write(chunk)).split('\n');
      tail = parts.pop();
      for (const part of parts) await take(part);
    }
    await take(tail + decoder.end());
  });
  return { documents, sha256: hash.digest('hex') };
}

// Checks a finished backup folder against its manifest. Returns a list of problems (empty = intact).
export async function verifyBackup(dir, { onDocument } = {}) {
  const problems = [];
  let manifest;
  try {
    manifest = JSON.parse(await fsp.readFile(path.join(dir, MANIFEST), 'utf8'));
  } catch (error) {
    return { manifest: null, problems: [`manifest.json cannot be read: ${error.message}`] };
  }
  if (manifest.format !== FORMAT) problems.push(`unknown backup format ${manifest.format}`);
  for (const [name, entry] of Object.entries(manifest.collections ?? {})) {
    const file = path.join(dir, entry.file);
    try {
      const seen = await readCollection(file, onDocument ? (doc) => onDocument(name, doc) : undefined);
      if (seen.sha256 !== entry.sha256) problems.push(`${name}: checksum differs (the file was changed or damaged)`);
      if (seen.documents !== entry.documents) problems.push(`${name}: ${seen.documents} documents in the file, ${entry.documents} in the manifest`);
    } catch (error) {
      problems.push(`${name}: cannot be read (${error.message})`);
    }
  }
  return { manifest, problems };
}

// The collections of the database (not views, not system collections), sorted.
export async function collectionNames(db) {
  const all = await db.listCollections({}, { nameOnly: true }).toArray();
  return all.filter((c) => (c.type ?? 'collection') === 'collection' && !c.name.startsWith('system.')).map((c) => c.name).sort();
}

// Writes one backup into `outDir`. Returns { dir, manifest }; throws if anything is wrong (the partial folder is
// removed, nothing half-finished is left behind).
export async function runBackup({ db, outDir, now = new Date(), log = console.log, verify = true }) {
  const name = `${FOLDER_PREFIX}${stamp(now)}`;
  const finalDir = path.join(outDir, name);
  const partial = `${finalDir}.partial`;
  await fsp.mkdir(outDir, { recursive: true });
  if (fs.existsSync(finalDir) || fs.existsSync(partial)) throw new Error(`${name} already exists in ${outDir}: wait a second and run again.`);
  await fsp.mkdir(partial);

  try {
    const collections = {};
    for (const collection of await collectionNames(db)) {
      const file = `${collection}.ndjson.gz`;
      const written = await writeCollection(db.collection(collection).find({}), path.join(partial, file));
      const indexes = (await actualIndexes(db, collection)).map(normaliseActual).filter((i) => i.name !== '_id_');
      collections[collection] = { file, ...written, indexes };
      log(`  ${collection.padEnd(14)} ${String(written.documents).padStart(7)} documents`);
    }
    const manifest = {
      format: FORMAT,
      createdAt: now.toISOString(),
      database: db.databaseName,
      collections,
      totals: {
        collections: Object.keys(collections).length,
        documents: Object.values(collections).reduce((sum, c) => sum + c.documents, 0),
      },
    };
    await fsp.writeFile(path.join(partial, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });

    if (verify) {
      const { problems } = await verifyBackup(partial);
      if (problems.length) throw new Error(`The backup failed its own check: ${problems.join('; ')}`);
      log('  verified: every file re-read, checksums and counts match the manifest');
    }
    await fsp.rename(partial, finalDir);
    return { dir: finalDir, manifest };
  } catch (error) {
    await fsp.rm(partial, { recursive: true, force: true });
    throw error;
  }
}

const OPTIONS = {
  out: { type: 'string' },
  'no-verify': { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

async function main() {
  const { values } = readArgs(OPTIONS);
  if (values.help || !values.out) {
    console.log('node scripts/backup.js --out <folder>   (read-only; the address comes from DATABASEURL or a hidden prompt)');
    if (!values.help) process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASEURL) (await import('dotenv')).default.config();
  const url = await readDatabaseUrl({ askHidden });
  const database = await openDatabase({ url, mongoose, appName: 'nhc-backup' });
  try {
    console.log(`Database: ${database.label}\nBacking up to ${path.resolve(values.out)}\n`);
    const { dir, manifest } = await runBackup({ db: database.db, outDir: values.out, verify: !values['no-verify'] });
    console.log(`\nBackup complete: ${dir}\n${manifest.totals.documents} documents in ${manifest.totals.collections} collections.`);
  } finally {
    await database.close();
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`Backup FAILED: ${error.message}`);
    process.exit(1);
  });
}
