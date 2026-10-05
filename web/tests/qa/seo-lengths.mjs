// Title/description length and duplicate checks over a matrix report:  node tests/qa/seo-lengths.mjs <report-dir>
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync(`${process.argv[2]}/matrix.json`, 'utf8'));
const seen = new Map();
const rows = m.results.filter((r) => r.vp === 'desktop' && r.route !== '/no-such-page-404' && r.meta);
for (const r of rows) {
  const t = r.meta.title ?? '';
  const d = r.meta.description ?? '';
  const flags = [];
  if (t.length > 70) flags.push(`title ${t.length}`);
  if (d.length > 170) flags.push(`description ${d.length}`);
  if (d.length < 50) flags.push(`description ${d.length} (short)`);
  const key = `${r.locale}|${t}`;
  if (seen.has(key)) flags.push(`duplicate title with ${seen.get(key)}`);
  else seen.set(key, r.route);
  if (flags.length) console.log(`${r.locale}${r.route}: ${flags.join(', ')}  | ${t}`);
}
console.log('checked', rows.length, 'pages');
