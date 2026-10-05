// Reports translation keys that exist in en.json but are missing in another locale (and the reverse).
// Usage: npm run check:i18n   (exit code 1 when a locale is out of sync)
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'translation');
const flat = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]);

const load = (f) => new Set(flat(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))));
const en = load('en.json');
let bad = false;

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'en.json')) {
  const keys = load(f);
  const missing = [...en].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !en.has(k));
  if (missing.length || extra.length) {
    bad = true;
    console.log(`${f}: ${missing.length} missing, ${extra.length} extra`);
    missing.forEach((k) => console.log(`  - missing ${k}`));
    extra.forEach((k) => console.log(`  - extra   ${k}`));
  }
}
console.log(bad ? 'Locales are out of sync.' : 'All locales match en.json.');
process.exit(bad ? 1 : 0);
