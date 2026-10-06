// Restores a backup made by scripts/backup.js into an EMPTY database.
//
//   cd server
//   node scripts/restore.js --from D:\NHC-Backups\nhc-backup-20261006-231500            DRY RUN (the default)
//   node scripts/restore.js --from D:\NHC-Backups\nhc-backup-20261006-231500 --apply    really restores
//
// Safety, in the order it is applied:
//   1. DRY RUN unless --apply is given. A dry run reads and checks everything and writes nothing.
//   2. The backup is verified first: every file is re-read; its SHA-256 and its document count must match the
//      manifest. One mismatch stops everything (a damaged backup must never be half-restored).
//   3. The target database must be EMPTY (no document in any collection). A database that already holds data is
//      refused, so this can never overwrite or mix into live data. To restore over a damaged database, restore into a
//      new empty one (a new Atlas database) and point DATABASEURL there (docs/BACKUP.md).
//   4. After the documents are written the indexes recorded in the manifest are created, and the document counts of
//      the target are compared with the manifest.
//
// The target address comes from DATABASEURL (environment or server/.env) or a hidden prompt, never from an argument.
// Only the host and database name are printed. CHECK THEM before using --apply.

import fsp from 'node:fs/promises';
import path from 'node:path';
import { askHidden } from './create-admin.js';
import { collectionNames, readCollection, verifyBackup } from './backup.js';
import { isMain, openDatabase, readArgs, readDatabaseUrl } from './lib/cli.js';
import { createOptions } from '../services/indexes.js';

export const BATCH = 500;

// Non-empty collections of the target: [{ name, documents }].
export async function occupiedCollections(db) {
  const found = [];
  for (const name of await collectionNames(db)) {
    const documents = await db.collection(name).estimatedDocumentCount();
    // estimatedDocumentCount can lag behind after unclean shutdowns; an exact check on an "empty" answer is cheap
    const exact = documents === 0 ? await db.collection(name).countDocuments({}) : documents;
    if (exact > 0) found.push({ name, documents: exact });
  }
  return found;
}

// Returns { ok, applied, problems, plan }. Never throws for a refusal: problems explain it.
export async function runRestore({ db, from, apply = false, log = console.log }) {
  const result = { ok: false, applied: false, problems: [], plan: [] };
  const fail = (...problems) => { result.problems.push(...problems); return result; };

  const dir = path.resolve(from);
  if (dir.endsWith('.partial')) return fail('That folder is an unfinished backup (.partial). Use a completed one.');
  const stat = await fsp.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) return fail(`${dir} is not a folder.`);

  log('Checking the backup (every file is re-read; this can take a while)...');
  const { manifest, problems } = await verifyBackup(dir);
  if (problems.length) return fail('The backup is damaged or incomplete, nothing was restored:', ...problems);
  log(`  backup of "${manifest.database}" made ${manifest.createdAt}: ${manifest.totals.documents} documents in ${manifest.totals.collections} collections. Every checksum and count matches.`);

  const occupied = await occupiedCollections(db);
  if (occupied.length) {
    return fail(
      `The target database is NOT empty (${occupied.map((o) => `${o.name}: ${o.documents}`).join(', ')}). ` +
      'A restore only goes into an empty database, so it can never overwrite live data. Restore into a new, empty database.',
    );
  }

  result.plan = Object.entries(manifest.collections).map(([name, c]) => ({ name, documents: c.documents, indexes: c.indexes.length }));
  for (const p of result.plan) log(`  ${apply ? 'restore' : 'would restore'}  ${p.name.padEnd(14)} ${String(p.documents).padStart(7)} documents, ${p.indexes} indexes`);

  if (!apply) {
    log('\nDRY RUN: nothing was written. The backup is intact and the target is empty. Run again with --apply to restore.');
    result.ok = true;
    return result;
  }

  for (const [name, entry] of Object.entries(manifest.collections)) {
    const collection = db.collection(name);
    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      await collection.insertMany(batch, { ordered: true });
      batch = [];
    };
    await db.createCollection(name).catch(() => {}); // an empty collection is restored too
    await readCollection(path.join(dir, entry.file), async (doc) => {
      batch.push(doc);
      if (batch.length >= BATCH) await flush();
    });
    await flush();
    for (const index of entry.indexes) {
      await collection.createIndex(index.key, createOptions(index));
    }
    log(`  restored ${name}`);
  }
  result.applied = true;

  // Compare what is there now with what the manifest says.
  const mismatches = [];
  for (const [name, entry] of Object.entries(manifest.collections)) {
    const count = await db.collection(name).countDocuments({});
    if (count !== entry.documents) mismatches.push(`${name}: ${count} documents in the database, ${entry.documents} in the backup`);
  }
  if (mismatches.length) return fail('The restore finished but the counts differ:', ...mismatches);
  log('\nRestored. Every collection has exactly the number of documents the backup recorded.');
  log('Next: run  node scripts/ensure-indexes.js  (dry run) to confirm no index is missing, then  node scripts/check-data.js.');
  result.ok = true;
  return result;
}

const OPTIONS = {
  from: { type: 'string' },
  apply: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

async function main() {
  const { values } = readArgs(OPTIONS);
  if (values.help || !values.from) {
    console.log('node scripts/restore.js --from <backup folder> [--apply]   (dry run unless --apply; target must be an EMPTY database)');
    if (!values.help) process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASEURL) (await import('dotenv')).default.config();
  const { default: mongoose } = await import('mongoose');
  const url = await readDatabaseUrl({ askHidden });
  const database = await openDatabase({ url, mongoose, appName: 'nhc-restore' });
  try {
    console.log(`Target database: ${database.label}  (${values.apply ? 'APPLY' : 'dry run'})\n`);
    const result = await runRestore({ db: database.db, from: values.from, apply: values.apply });
    if (!result.ok) {
      console.error(result.problems.join('\n'));
      process.exitCode = 1;
    }
  } finally {
    await database.close();
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`Restore FAILED: ${error.message}`);
    process.exit(1);
  });
}
