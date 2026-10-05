// Group a matrix report's issues by page + message (locales and viewports collapsed):
//   node tests/qa/summarize.mjs <report-dir> [skipRegex]
import fs from 'node:fs';
const [dir, skip] = process.argv.slice(2);
const lines = fs.readFileSync(`${dir}/issues.txt`, 'utf8').split('\n').filter(Boolean);
const groups = new Map();
for (const line of lines) {
  const m = /^(\S+) (\S+?)(\/\S*)? @(\S+): (.*)$/.exec(line);
  if (!m) continue;
  const [, sev, loc, route = '/', vp, msg] = m;
  if (skip && new RegExp(skip).test(line)) continue;
  const key = `${sev} ${route} :: ${msg.replace(/https?:\/\/localhost:\d+/g, '').slice(0, 150)}`;
  const g = groups.get(key) ?? { locs: new Set(), vps: new Set() };
  g.locs.add(loc);
  g.vps.add(vp);
  groups.set(key, g);
}
for (const [k, g] of [...groups].sort()) console.log(`${k}   [${g.locs.size} locales; ${[...g.vps].join(',')}]`);
