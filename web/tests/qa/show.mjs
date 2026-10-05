// Inspect a matrix report:  node tests/qa/show.mjs <report-dir> [urlSuffix] [viewport]
import fs from 'node:fs';
const [dir, suffix, vp = 'desktop'] = process.argv.slice(2);
const m = JSON.parse(fs.readFileSync(`${dir}/matrix.json`, 'utf8'));
console.log('blocked hosts:', m.blocked);
if (suffix) {
  const r = m.results.find((x) => x.url.endsWith(suffix) && x.vp === vp);
  console.log(JSON.stringify(r, null, 1));
} else {
  for (const r of m.results) if (r.console.some((c) => /ERR_FAILED/.test(c))) console.log(r.url, r.vp, r.failed, r.console);
}
