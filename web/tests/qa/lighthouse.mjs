// Lighthouse (through npx, not a project dependency) on the pages of docs/PERFORMANCE.md, mobile and desktop.
//   QA_BASE=http://localhost:3801 QA_LABEL=before CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node tests/qa/lighthouse.mjs
// Writes the raw reports to QA_LH_DIR (default ./lh-<label>) and prints one row per page and form factor.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.QA_BASE ?? 'http://localhost:3801';
const LABEL = process.env.QA_LABEL ?? 'run';
const DIR = process.env.QA_LH_DIR ?? `lh-${LABEL}`;
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGES = (process.env.QA_PAGES ?? '/en,/en/sites/latin,/en/shop,/en/candle,/en/gallery').split(',');
mkdirSync(DIR, { recursive: true });

const kb = (n) => (n / 1024).toFixed(0);
for (const form of ['mobile', 'desktop']) {
  for (const path of PAGES) {
    const out = join(DIR, `${form}${path.replace(/\W+/g, '_')}.json`);
    const args = ['-y', 'lighthouse@12', BASE + path, `--chrome-path=${CHROME}`, '--chrome-flags=--headless=new', '--output=json', `--output-path=${out}`, '--quiet', '--only-categories=performance'];
    if (form === 'desktop') args.push('--preset=desktop');
    spawnSync('npx', args, { shell: true, stdio: 'ignore' });
    try {
      const r = JSON.parse(readFileSync(out, 'utf8'));
      const a = r.audits;
      const by = (t) => a['resource-summary'].details.items.find((i) => i.resourceType === t)?.transferSize ?? 0;
      console.log(
        `${form.padEnd(8)} ${path.padEnd(18)} score ${Math.round(r.categories.performance.score * 100)}  FCP ${(a['first-contentful-paint'].numericValue / 1000).toFixed(1)}  LCP ${(a['largest-contentful-paint'].numericValue / 1000).toFixed(1)}  CLS ${a['cumulative-layout-shift'].numericValue.toFixed(3)}  TBT ${Math.round(a['total-blocking-time'].numericValue)}  total ${kb(by('total'))} kB  img ${kb(by('image'))}  js ${kb(by('script'))}  media ${kb(by('media'))}`,
      );
    } catch (e) {
      console.log(`${form} ${path} FAILED ${e.message}`);
    }
  }
}
