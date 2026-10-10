import fs from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const guard = require('./braces-depth-guard.cjs');
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run security:audit');
const result = spawnSync(process.execPath, [npm, 'audit', '--json'], { encoding: 'utf8', maxBuffer: 5_000_000 });
const audit = JSON.parse(result.stdout || '{}');
if (!audit.metadata || audit.error) throw new Error('Dependency audit could not complete');
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const expires = Date.parse('2026-11-06T00:00:00Z');
const allowed = 'GHSA-vfj7-8cjw-p6xm';
function onlyMitigated(v, seen = new Set()) {
  if (seen.has(v.name)) return false;
  seen.add(v.name);
  return v.via.length > 0 && v.via.every(item => typeof item === 'string'
    ? audit.vulnerabilities[item] && onlyMitigated(audit.vulnerabilities[item], new Set(seen))
    : item.url?.endsWith('/' + allowed));
}
let failed = false;
let protectedTool = false;
if (guard.installed && Date.now() < expires) {
  const nested = '{'.repeat(10000) + 'a,b' + '}'.repeat(10000);
  let ast = { type: 'text', value: 'a' };
  for (let i = 0; i < 10000; i++) ast = { type: 'brace', nodes: [ast] };
  const checks = ['parse', 'compile', 'expand', 'stringify', 'create'].flatMap(method => [nested, ast].map(input => () => guard.braces[method](input)));
  protectedTool = checks.every(run => {
    try { run(); return false; }
    catch (error) { return error instanceof SyntaxError && /safe limit/.test(error.message); }
  }) && JSON.stringify(guard.braces.expand('a{b,c}')) === JSON.stringify(['ab', 'ac']);
}
for (const v of Object.values(audit.vulnerabilities ?? {})) {
  const devOnly = v.nodes.length > 0 && v.nodes.every(node => lock.packages[node]?.dev === true);
  if (devOnly && protectedTool && onlyMitigated(v)) console.log(`MITIGATED ${v.name}: ${allowed}; bounded glob depth; expires 2026-11-06`);
  else { console.error(`UNRESOLVED ${v.name}: ${v.severity}`); failed = true; }
}
console.log(`Audited production AND development dependencies; ${audit.metadata.vulnerabilities.total} reported package entries.`);
process.exitCode = failed ? 1 : 0;
