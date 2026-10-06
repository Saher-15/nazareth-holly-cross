import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';

// The operations scripts only read the models' declarations; a model compiled here must never try to build indexes
// or create collections on a connection of its own. (Imported before the models: ES modules run in import order.)
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

// Shared by the operations scripts (backup, restore, ensure-indexes, check-data, reconcile-payments).
//
// The database address is a secret (it carries the password). It is read from the DATABASEURL environment variable,
// or typed at a hidden prompt when there is a terminal; it is never taken from an argument (shell history and
// process lists would keep it) and never printed: only the host name and the database name are shown, so a person
// can check they are pointing at the database they mean.

// "cluster0.abcde.mongodb.net/nazareth" from a mongodb:// or mongodb+srv:// address, or null when it is not one.
export function describeTarget(url) {
  try {
    const u = new URL(url);
    if (!/^mongodb(\+srv)?:$/.test(u.protocol)) return null;
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return null;
  }
}

// The database name an address points at ('' when it names none; Mongo then uses "test").
export function databaseNameOf(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
}

// DATABASEURL from the environment, else a hidden prompt (only on a terminal). Throws a short message otherwise.
export async function readDatabaseUrl({ env = process.env, askHidden, isTTY = process.stdin.isTTY } = {}) {
  const fromEnv = (env.DATABASEURL ?? '').trim();
  if (fromEnv) return fromEnv;
  if (!isTTY || !askHidden) throw new Error('DATABASEURL is not set. Set it in the environment (never on the command line) or run this in a terminal to be asked for it.');
  const typed = (await askHidden('MongoDB connection string (hidden): ')).trim();
  if (!typed) throw new Error('No database address given.');
  return typed;
}

// Opens a connection and returns { db, close, label, name }. `db` is the driver's Db (what the scripts use).
export async function openDatabase({ url, mongoose, appName = 'nhc-ops' }) {
  const label = describeTarget(url);
  if (!label) throw new Error('The database address is not a mongodb:// or mongodb+srv:// address.');
  const connection = await mongoose.createConnection(url, { serverSelectionTimeoutMS: 15_000, appName, autoIndex: false, autoCreate: false }).asPromise();
  return {
    db: connection.db,
    name: connection.db.databaseName,
    label,
    close: () => connection.close().catch(() => {}),
  };
}

// Arguments as { values, positionals }. Unknown options are an error (a typo in --apply must never mean "dry run").
export function readArgs(options, argv = process.argv.slice(2)) {
  return parseArgs({ args: argv, options, allowPositionals: true, strict: true });
}

// True when this file is the one node was started with (so a script can be imported by tests without running).
export const isMain = (metaUrl, argv = process.argv) => Boolean(argv[1]) && metaUrl === pathToFileURL(argv[1]).href;

export const stamp = (date = new Date()) => date.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-'); // 20261006-231500
