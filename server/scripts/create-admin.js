// Creates an OWNER account for the admin dashboard, from a terminal:
//
//   cd server
//   node scripts/create-admin.js
//
// It asks for the username and the password (typed twice, hidden). Credentials are only ever typed at the prompt:
// never from arguments (they would end up in shell history and process lists) and never from environment variables.
// The password must pass the same policy as the dashboard (12+ characters, not the username, not a common password).
// It connects to the database in DATABASEURL (server/.env): check the host it prints before typing a password.
//
// Use it once to create the first owner; further users are created by an owner in the dashboard (POST /admin/users).

import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

export const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;
const MAX_PASSWORD_TRIES = 3;

export function askVisible(prompt, input = process.stdin, output = process.stdout) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Reads a line from a terminal without echoing it. Backspace edits, Enter ends, Ctrl+C cancels.
export function askHidden(prompt, input = process.stdin, output = process.stdout) {
  return new Promise((resolve, reject) => {
    output.write(prompt);
    let value = '';
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    const finish = (fn) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener('data', onData);
      output.write('\n');
      fn();
    };
    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return finish(() => resolve(value));
        if (ch === '\u0003') return finish(() => reject(new Error('Cancelled')));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
      return undefined;
    }
    input.on('data', onData);
  });
}

// The whole conversation, with everything it touches passed in so it can be tested without a terminal or a database.
//   ask(prompt) -> text      askHidden(prompt) -> text      Admin: the model      hash(plain) -> bcrypt hash
//   checkPassword(password, username) -> null | reason
export async function createOwner({ ask, askHidden: askSecret, Admin, hash, checkPassword, log = console.log }) {
  const username = await ask('Username (letters, digits . _ -, 3-64 characters): ');
  if (!USERNAME.test(username)) throw new Error('That username is not allowed (letters, digits, . _ - ; 3 to 64 characters).');
  if (await Admin.findOne({ username })) throw new Error('That username already exists. Nothing was changed.');

  let password = null;
  for (let attempt = 1; attempt <= MAX_PASSWORD_TRIES && password === null; attempt += 1) {
    const candidate = await askSecret('Password (hidden): ');
    const problem = checkPassword(candidate, username);
    if (problem) {
      log(`Refused: ${problem}.`);
      continue;
    }
    const again = await askSecret('Repeat the password: ');
    if (again !== candidate) {
      log('Refused: the two passwords differ.');
      continue;
    }
    password = candidate;
  }
  if (password === null) throw new Error('No acceptable password was given. Nothing was changed.');

  const admin = new Admin({ username, password: await hash(password), role: 'owner' });
  admin.$locals.passwordHashed = true; // already hashed: the model's save hook must not hash it again
  await admin.save();
  log(`Owner "${username}" created. Sign in at the admin dashboard; turn on two-factor sign-in under your account.`);
  return { username };
}

// Refuses to run unless it is a person at a terminal with no arguments.
export function invocationProblem({ argv = process.argv, stdin = process.stdin, stdout = process.stdout } = {}) {
  if (argv.length > 2) return 'This script takes no arguments: credentials are typed at the prompts, never on the command line.';
  if (!stdin.isTTY || !stdout.isTTY) return 'This script must be run in an interactive terminal (the password is typed hidden).';
  return null;
}

async function main() {
  const problem = invocationProblem();
  if (problem) {
    console.error(problem);
    process.exit(1);
  }

  const [{ default: mongoose }, { config }, { default: Admin }, { hashPassword }, { checkPasswordPolicy }, { applyMongooseSafety }] =
    await Promise.all([
      import('mongoose'),
      import('../config/env.js'),
      import('../model/admin.js'),
      import('../services/adminAuth.js'),
      import('../services/passwordPolicy.js'),
      import('../config/mongoose.js'),
    ]);

  if (!config.databaseUrl) {
    console.error('DATABASEURL is not set (server/.env).');
    process.exit(1);
  }
  let target = 'the configured database';
  try {
    const u = new URL(config.databaseUrl);
    target = `${u.host}${u.pathname}`; // host and database name only, never the credentials
  } catch { /* keep the generic text */ }
  console.log(`Database: ${target}`);

  applyMongooseSafety();
  try {
    await mongoose.connect(config.databaseUrl, { serverSelectionTimeoutMS: 10000 });
    await createOwner({ ask: askVisible, askHidden, Admin, hash: hashPassword, checkPassword: checkPasswordPolicy });
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
