// Lists message values identical to English in other languages (candidates for "not translated yet").
import fs from 'node:fs';
const dir = new URL('../../src/messages/', import.meta.url);
const load = (l) => JSON.parse(fs.readFileSync(new URL(`${l}.json`, dir), 'utf8'));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const en = Object.fromEntries(flat(load('en')));
const KEEP = /^(\W*|[A-Z0-9 .,:/+-]{1,6}|https?:.*|.*@.*)$/;
for (const l of ['fr', 'es', 'de', 'it', 'pt', 'pl', 'ru', 'el', 'he', 'ar']) {
  const m = Object.fromEntries(flat(load(l)));
  const same = Object.keys(en).filter((k) => m[k] === en[k] && !KEEP.test(en[k]) && en[k].length > 12);
  const missing = Object.keys(en).filter((k) => !(k in m));
  console.log(`${l}: ${Object.keys(m).length} keys, missing ${missing.length}, identical-to-English (len>12) ${same.length}`);
  if (process.env.V) console.log('   ', same.slice(0, 40).map((k) => `${k}=${en[k].slice(0, 40)}`).join('\n    '));
}
