import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import mongoose from 'mongoose';

// scripts/backup.js and scripts/restore.js against an in-memory stand-in for the MongoDB driver (no database).

vi.unmock('../model/payment.js'); // these scripts read the REAL model declarations
vi.unmock('../model/liveSession.js');

const { EJSON } = mongoose.mongo.BSON;
const { fakeDb } = await import('../test-harness/fake-db.js');
const { runBackup, verifyBackup, readCollection, collectionNames, FOLDER_PREFIX, MANIFEST } = await import('../scripts/backup.js');
const { runRestore } = await import('../scripts/restore.js');
const { ensureIndexes } = await import('../scripts/ensure-indexes.js');
const { describeTarget, databaseNameOf, readDatabaseUrl, readArgs, stamp } = await import('../scripts/lib/cli.js');
const { recorded, sample, seededDb, newId } = await import('./helpers/ops.js');

const quiet = () => {};
let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nhc-backup-test-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const canonical = (docs) => docs.map((d) => EJSON.stringify(d, { relaxed: false })).sort();
const allDocs = (db) => Object.fromEntries(db.names().map((n) => [n, canonical(db.docs(n))]));

// A database as the ensure-indexes script leaves it, with the sample documents in it.
async function liveDatabase() {
  const db = seededDb();
  const { failed } = await ensureIndexes({ db, apply: true, log: quiet });
  expect(failed).toEqual([]);
  return db;
}

describe('backup', () => {
  it('writes one gzipped NDJSON file per collection and a manifest with counts, sizes and SHA-256', async () => {
    const db = await liveDatabase();
    const { dir: folder, manifest } = await runBackup({ db, outDir: dir, now: new Date('2026-10-06T21:15:00Z'), log: quiet });

    expect(path.basename(folder)).toBe(`${FOLDER_PREFIX}20261006-211500`);
    expect(fs.readdirSync(dir)).toEqual([path.basename(folder)]); // no .partial left behind
    const files = fs.readdirSync(folder).sort();
    expect(files).toContain(MANIFEST);
    for (const [name, entry] of Object.entries(manifest.collections)) {
      expect(files).toContain(`${name}.ndjson.gz`);
      expect(entry.documents).toBe(db.docs(name).length);
      const bytes = fs.readFileSync(path.join(folder, entry.file));
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
      expect(zlib.gunzipSync(bytes).toString().split('\n').filter(Boolean)).toHaveLength(entry.documents);
    }
    expect(Object.keys(manifest.collections).sort()).toEqual(db.names().sort()); // EVERY collection
    expect(manifest.totals.documents).toBe(Object.values(sample()).reduce((n, docs) => n + docs.length, 0));
    expect(manifest.database).toBe('nhc_test');
    expect(JSON.parse(fs.readFileSync(path.join(folder, MANIFEST), 'utf8'))).toEqual(manifest);
  });

  it('records the indexes of each collection (text, unique, partial, TTL) in the manifest', async () => {
    const db = await liveDatabase();
    const { manifest } = await runBackup({ db, outDir: dir, log: quiet });
    const order = manifest.collections.order.indexes;
    expect(order.find((i) => JSON.stringify(i.key) === '{"paypalOrderId":1}').options).toMatchObject({ unique: true, partialFilterExpression: { paypalOrderId: { $type: 'string' } } });
    expect(manifest.collections.product.indexes.find((i) => i.name === 'name_text_description_text').key).toEqual({ name: 'text', description: 'text' });
    expect(manifest.collections.auditLog.indexes.some((i) => i.options.expireAfterSeconds === 180 * 86400)).toBe(true);
    expect(manifest.collections.order.indexes.some((i) => i.name === '_id_')).toBe(false);
  });

  it('is read-only: it only lists, reads and counts', async () => {
    const { db, calls } = recorded(await liveDatabase());
    calls.length = 0;
    await runBackup({ db, outDir: dir, log: quiet });
    const verbs = new Set(calls.map((c) => c.split('.').pop()));
    expect([...verbs].sort()).toEqual(['find', 'indexes', 'listCollections']);
  });

  it('keeps every value exactly (ObjectId, dates, numbers, nested documents)', async () => {
    const db = await liveDatabase();
    const { dir: folder } = await runBackup({ db, outDir: dir, log: quiet });
    const read = [];
    await readCollection(path.join(folder, 'order.ndjson.gz'), (doc) => read.push(doc));
    expect(canonical(read)).toEqual(canonical(db.docs('order')));
    expect(read[0]._id).toBeInstanceOf(mongoose.mongo.ObjectId);
    expect(read[0].createdAt).toBeInstanceOf(Date);
    expect(read[0].products[0].productID).toBeInstanceOf(mongoose.mongo.ObjectId);
  });

  it('backs up an empty collection and an empty database', async () => {
    const empty = fakeDb();
    await empty.createCollection('order');
    const { manifest } = await runBackup({ db: empty, outDir: dir, log: quiet });
    expect(manifest.collections.order.documents).toBe(0);
    const none = await runBackup({ db: fakeDb(), outDir: path.join(dir, 'nothing'), log: quiet });
    expect(none.manifest.totals).toEqual({ collections: 0, documents: 0 });
  });

  it('leaves no half-finished folder when it fails, and never overwrites an existing backup', async () => {
    const db = await liveDatabase();
    const broken = { ...db, databaseName: 'x', listCollections: db.listCollections, collection: (name) => ({ ...db.collection(name), find: () => ({ async *[Symbol.asyncIterator]() { throw new Error('connection lost'); } }) }) };
    await expect(runBackup({ db: broken, outDir: dir, log: quiet })).rejects.toThrow('connection lost');
    expect(fs.readdirSync(dir)).toEqual([]);

    const now = new Date('2026-10-06T21:15:00Z');
    await runBackup({ db, outDir: dir, now, log: quiet });
    await expect(runBackup({ db, outDir: dir, now, log: quiet })).rejects.toThrow(/already exists/);
  });

  it('skips views and system collections', async () => {
    const db = seededDb();
    db.seed('system.profile', [{ x: 1 }]);
    expect(await collectionNames(db)).not.toContain('system.profile');
  });
});

describe('verifyBackup', () => {
  const backup = async () => (await runBackup({ db: await liveDatabase(), outDir: dir, log: quiet })).dir;

  it('passes an intact backup', async () => {
    expect((await verifyBackup(await backup())).problems).toEqual([]);
  });

  it('notices a changed byte, a truncated file, a deleted file and a manifest that disagrees', async () => {
    const folder = await backup();
    const file = path.join(folder, 'order.ndjson.gz');
    const original = fs.readFileSync(file);

    const flipped = Buffer.from(original);
    flipped[flipped.length - 12] ^= 0xff;
    fs.writeFileSync(file, flipped);
    expect((await verifyBackup(folder)).problems.join(' ')).toMatch(/order/);

    fs.writeFileSync(file, original.subarray(0, original.length - 20));
    expect((await verifyBackup(folder)).problems.join(' ')).toMatch(/order/);

    fs.rmSync(file);
    expect((await verifyBackup(folder)).problems.join(' ')).toMatch(/order: cannot be read/);

    fs.writeFileSync(file, original);
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, MANIFEST), 'utf8'));
    manifest.collections.order.documents += 1;
    fs.writeFileSync(path.join(folder, MANIFEST), JSON.stringify(manifest));
    expect((await verifyBackup(folder)).problems.join(' ')).toMatch(/order: 2 documents in the file, 3 in the manifest/);
  });

  it('reports a missing manifest', async () => {
    const folder = await backup();
    fs.rmSync(path.join(folder, MANIFEST));
    expect((await verifyBackup(folder)).problems[0]).toMatch(/manifest.json cannot be read/);
  });
});

describe('restore', () => {
  const backupOf = async (db) => (await runBackup({ db: db ?? (await liveDatabase()), outDir: dir, log: quiet })).dir;

  it('DRY RUN by default: checks the backup and the target, writes nothing', async () => {
    const source = await liveDatabase();
    const folder = await backupOf(source);
    const target = fakeDb({ name: 'new_db' });
    const { db, calls } = recorded(target);
    const lines = [];
    const result = await runRestore({ db, from: folder, log: (l) => lines.push(l) });
    expect(result).toMatchObject({ ok: true, applied: false, problems: [] });
    expect(lines.join('\n')).toMatch(/DRY RUN: nothing was written/);
    expect(target.names()).toEqual([]);
    expect(calls.filter((c) => /insert|createIndex|createCollection/.test(c))).toEqual([]);
  });

  it('--apply restores every document exactly, and the indexes, into an empty database', async () => {
    const source = await liveDatabase();
    const folder = await backupOf(source);
    const target = fakeDb({ name: 'new_db' });
    const result = await runRestore({ db: target, from: folder, apply: true, log: quiet });
    expect(result).toMatchObject({ ok: true, applied: true, problems: [] });
    expect(allDocs(target)).toEqual(allDocs(source));
    // ...and the same indexes (a restored database passes the index check as if it had never been lost)
    const plan = await ensureIndexes({ db: target, log: quiet });
    expect(plan.plan.flatMap((p) => [...p.missing, ...p.conflict])).toEqual([]);
    const order = await target.collection('order').indexes();
    expect(order.some((i) => i.unique && i.partialFilterExpression)).toBe(true);
  });

  it('restores an empty collection too', async () => {
    const source = fakeDb();
    await source.createCollection('review');
    const target = fakeDb();
    const result = await runRestore({ db: target, from: await backupOf(source), apply: true, log: quiet });
    expect(result.ok).toBe(true);
    expect(target.names()).toEqual(['review']);
  });

  it('REFUSES a database that already holds data (a restore can never overwrite or mix into live data)', async () => {
    const folder = await backupOf();
    const target = seededDb({ order: [{ _id: newId(), firstName: 'Live' }] }, 'production');
    for (const apply of [false, true]) {
      const result = await runRestore({ db: target, from: folder, apply, log: quiet });
      expect(result.ok).toBe(false);
      expect(result.problems.join(' ')).toMatch(/NOT empty \(order: 1\)/);
    }
    expect(target.docs('order')).toHaveLength(1);
    expect(target.names()).toEqual(['order']);
  });

  it('accepts a target whose collections exist but are empty', async () => {
    const folder = await backupOf();
    const target = fakeDb();
    await target.createCollection('order');
    expect((await runRestore({ db: target, from: folder, apply: true, log: quiet })).ok).toBe(true);
  });

  it('verifies the checksums FIRST: a damaged backup restores nothing', async () => {
    const folder = await backupOf();
    const file = path.join(folder, 'product.ndjson.gz');
    const bytes = fs.readFileSync(file);
    bytes[bytes.length - 12] ^= 0xff;
    fs.writeFileSync(file, bytes);
    const target = fakeDb();
    const result = await runRestore({ db: target, from: folder, apply: true, log: quiet });
    expect(result.ok).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.problems.join(' ')).toMatch(/damaged or incomplete/);
    expect(target.names()).toEqual([]);
  });

  it('refuses an unfinished (.partial) folder and a path that is not a folder', async () => {
    const partial = path.join(dir, 'nhc-backup-x.partial');
    fs.mkdirSync(partial);
    expect((await runRestore({ db: fakeDb(), from: partial, log: quiet })).problems[0]).toMatch(/unfinished backup/);
    expect((await runRestore({ db: fakeDb(), from: path.join(dir, 'nope'), log: quiet })).problems[0]).toMatch(/not a folder/);
  });

  it('reports a restore whose counts do not match, instead of claiming success', async () => {
    const folder = await backupOf();
    const target = fakeDb();
    const insert = target.collection('candle').insertMany;
    const lossy = new Proxy(target, {
      get: (t, prop) => (prop === 'collection'
        ? (name) => (name === 'candle' ? { ...t.collection(name), insertMany: async (docs, o) => insert.call(t.collection('candle'), docs.slice(1), o) } : t.collection(name))
        : t[prop]),
    });
    const result = await runRestore({ db: lossy, from: folder, apply: true, log: quiet });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/candle: 0 documents in the database, 1 in the backup/);
  });
});

describe('the database address', () => {
  it('is read from the environment or a hidden prompt, never from an argument', async () => {
    expect(await readDatabaseUrl({ env: { DATABASEURL: ' mongodb+srv://u:p@h.example.net/db ' }, isTTY: false })).toBe('mongodb+srv://u:p@h.example.net/db');
    await expect(readDatabaseUrl({ env: {}, isTTY: false })).rejects.toThrow(/DATABASEURL is not set/);
    const askHidden = vi.fn(async () => 'mongodb://typed.example.net/db');
    expect(await readDatabaseUrl({ env: {}, isTTY: true, askHidden })).toBe('mongodb://typed.example.net/db');
    expect(askHidden).toHaveBeenCalledOnce();
    await expect(readDatabaseUrl({ env: {}, isTTY: true, askHidden: async () => '  ' })).rejects.toThrow(/No database address/);
    expect(() => readArgs({ out: { type: 'string' } }, ['--url', 'mongodb://secret'])).toThrow(); // there is no such option
  });

  it('is shown as host and database name only, never with the credentials', () => {
    const url = 'mongodb+srv://saher:Sup3rS3cret!@cluster0.abcde.mongodb.net/nazareth?retryWrites=true&w=majority';
    expect(describeTarget(url)).toBe('cluster0.abcde.mongodb.net/nazareth');
    expect(describeTarget(url)).not.toMatch(/saher|Sup3r/);
    expect(describeTarget('mongodb://127.0.0.1:27017')).toBe('127.0.0.1:27017');
    expect(describeTarget('https://example.com')).toBeNull();
    expect(describeTarget('not a url')).toBeNull();
    expect(databaseNameOf(url)).toBe('nazareth');
  });

  it('never appears in what the scripts print or write', async () => {
    const secret = 'Sup3rS3cret-url-password';
    const lines = [];
    const db = await liveDatabase();
    const { dir: folder } = await runBackup({ db, outDir: dir, log: (l) => lines.push(l) });
    await runRestore({ db: fakeDb(), from: folder, apply: true, log: (l) => lines.push(l) });
    const written = fs.readdirSync(folder).map((f) => (f.endsWith('.json') ? fs.readFileSync(path.join(folder, f), 'utf8') : '')).join('');
    expect(lines.join('\n') + written).not.toContain(secret);
    expect(stamp(new Date('2026-10-06T21:15:00Z'))).toBe('20261006-211500');
  });
});
