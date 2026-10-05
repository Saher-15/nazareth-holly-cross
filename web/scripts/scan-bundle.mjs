// Fails when a server-side secret could have ended up in what the browser downloads.
//
//   npm run build && npm run scan:bundle
//
// Looks through .next/static (everything served to browsers) and .next/server (server code and the
// pre-rendered pages) for the names of the API's secret settings and for the shapes of well-known
// credentials. It prints where something was found and which rule matched, never the text itself.
// Public-by-design values (the PayPal client id, Firebase Storage download links) are not flagged.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '.next');
const DIRS = ['static', 'server'];

const RULES = [
  ['server setting name', /\b(JWT_SECRET|ADMIN_PASSWORD|MAIL_APP_PASSWORD|CLIENT_SECRET|DATABASEURL)\b/],
  ['database connection string', /mongodb(\+srv)?:\/\/[^\s"'`]+/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  // Not inside a longer base64 run: embedded assets (fonts, images, source maps) contain such runs.
  ['PayPal secret-shaped token', /(?<![A-Za-z0-9+/=_-])E[A-Za-z0-9_-]{70,90}(?![A-Za-z0-9+/=_-])/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Stripe live key', /\b[sr]k_live_[0-9A-Za-z]{20,}\b/],
  ['signed JWT', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
];

const TEXT = /\.(js|mjs|cjs|css|html|json|txt|rsc|map|body|meta)$/i;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) yield* files(full);
    else if (TEXT.test(name) && info.size < 20 * 1024 * 1024) yield full;
  }
}

let scanned = 0;
const findings = [];
for (const sub of DIRS) {
  const dir = path.join(ROOT, sub);
  try {
    statSync(dir);
  } catch {
    console.error(`${dir} does not exist: run "npm run build" first.`);
    process.exit(2);
  }
  for (const file of files(dir)) {
    scanned += 1;
    const text = readFileSync(file, 'utf8');
    for (const [name, pattern] of RULES) {
      if (pattern.test(text)) findings.push(`${name}: ${path.relative(ROOT, file)}`);
    }
  }
}

console.log(`Scanned ${scanned} build files.`);
if (findings.length) {
  console.error(`\nPossible secrets in the build output (${findings.length}):\n${findings.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('No secrets found in the build output.');
