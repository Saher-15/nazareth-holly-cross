// Makes the database's indexes match the ones the models declare (server/model/*.js, `schema.index(...)`).
//
//   cd server
//   node scripts/ensure-indexes.js                    DRY RUN (the default): lists what it would create / drop
//   node scripts/ensure-indexes.js --apply            creates the missing indexes
//   node scripts/ensure-indexes.js --apply --replace-conflicts   also drops an index whose definition differs
//                                                     from the model's, then creates the model's version
//   node scripts/ensure-indexes.js --apply --prune    also drops indexes no model declares (leftovers)
//
// It changes INDEXES only, never documents or collections: no data can be lost by running it. Creating an index on
// a big collection takes time and some memory on the server; the collections here are small (docs/DATABASE.md).
// The production server does not build indexes by itself (config/indexPolicy.js): run this once when a release
// adds or changes one (the release notes and docs/DATABASE.md say so), and any time the start-up log warns about
// a missing index.
//
// The database address comes from DATABASEURL (environment, server/.env) or a hidden prompt, never from an argument.
// Only the host and database name are printed.

import { askHidden } from './create-admin.js';
import { isMain, openDatabase, readArgs, readDatabaseUrl } from './lib/cli.js';
import { MODELS, createOptions, planIndexes } from '../services/indexes.js';

const OPTIONS = {
  apply: { type: 'boolean', default: false },
  'replace-conflicts': { type: 'boolean', default: false },
  prune: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

const describe = (i) => `${i.name}  ${JSON.stringify(i.key)}${Object.keys(i.options).length ? ` ${JSON.stringify(i.options)}` : ''}`;

// Prints (and, with apply, performs) the plan. `db` is a driver Db (or anything with the same few methods).
// Returns { plan, created, dropped, failed }.
export async function ensureIndexes({ db, models = MODELS, apply = false, replaceConflicts = false, prune = false, log = console.log }) {
  const plan = await planIndexes(db, models);
  const result = { plan, created: [], dropped: [], failed: [], skipped: [] };

  let pending = 0;
  for (const p of plan) {
    if (!p.missing.length && !p.conflict.length && !p.extra.length) {
      log(`  ok       ${p.collection}`);
      continue;
    }
    log(`  ${p.collection}`);
    for (const i of p.missing) { log(`    CREATE   ${describe(i)}`); pending += 1; }
    for (const c of p.conflict) {
      log(`    CONFLICT ${describe(c.existing)}`);
      log(`             the model wants ${describe(c.wanted)}`);
      log(`             -> ${replaceConflicts ? 'DROP the existing one, then CREATE the model\'s' : 'left alone (add --replace-conflicts to drop it and create the model\'s)'}`);
      pending += 1;
    }
    for (const i of p.extra) {
      log(`    EXTRA    ${describe(i)}  (no model declares it) -> ${prune ? 'DROP' : 'left alone (add --prune to drop it)'}`);
    }
  }

  if (!apply) {
    log(pending || plan.some((p) => p.extra.length)
      ? '\nDRY RUN: nothing was changed. Run again with --apply to create the missing indexes.'
      : '\nEvery index the models declare exists. Nothing to do.');
    return result;
  }

  for (const p of plan) {
    const collection = db.collection(p.collection);
    const create = async (index) => {
      try {
        await collection.createIndex(index.key, createOptions(index));
        result.created.push({ collection: p.collection, index: index.name });
        log(`  created  ${p.collection}.${index.name}`);
      } catch (error) {
        result.failed.push({ collection: p.collection, index: index.name, error: error.message });
        log(`  FAILED   ${p.collection}.${index.name}: ${error.message}`);
      }
    };
    const drop = async (index) => {
      try {
        await collection.dropIndex(index.name);
        result.dropped.push({ collection: p.collection, index: index.name });
        log(`  dropped  ${p.collection}.${index.name}`);
        return true;
      } catch (error) {
        result.failed.push({ collection: p.collection, index: index.name, error: error.message });
        log(`  FAILED   drop ${p.collection}.${index.name}: ${error.message}`);
        return false;
      }
    };

    for (const index of p.missing) await create(index);
    for (const { existing, wanted } of p.conflict) {
      if (!replaceConflicts) { result.skipped.push({ collection: p.collection, index: wanted.name }); continue; }
      if (await drop(existing)) await create(wanted);
    }
    if (prune) for (const index of p.extra) await drop(index);
  }
  log(`\nDone: ${result.created.length} created, ${result.dropped.length} dropped, ${result.failed.length} failed, ${result.skipped.length} conflicts left alone.`);
  return result;
}

async function main() {
  const { values } = readArgs(OPTIONS);
  if (values.help) {
    console.log('node scripts/ensure-indexes.js [--apply] [--replace-conflicts] [--prune]   (dry run unless --apply)');
    return;
  }
  if (!process.env.DATABASEURL) (await import('dotenv')).default.config();
  const { default: mongoose } = await import('mongoose');
  const url = await readDatabaseUrl({ askHidden });
  const database = await openDatabase({ url, mongoose, appName: 'nhc-ensure-indexes' });
  try {
    console.log(`Database: ${database.label}  (${values.apply ? 'APPLY' : 'dry run'})\n`);
    const { failed } = await ensureIndexes({
      db: database.db, apply: values.apply, replaceConflicts: values['replace-conflicts'], prune: values.prune,
    });
    if (failed.length) process.exitCode = 1;
  } finally {
    await database.close();
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
