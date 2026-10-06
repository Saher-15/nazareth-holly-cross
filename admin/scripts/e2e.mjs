// Runs the Playwright suite against one backend:
//   node scripts/e2e.mjs mock        the mock of the contract (same as `npm run test:e2e`)
//   node scripts/e2e.mjs harness     the REAL API over in-memory models (server/test-harness)
// Extra arguments go to Playwright: node scripts/e2e.mjs harness --project=desktop -g "orders"
// (Setting the variable here keeps the command the same on Windows, macOS and Linux.)
import { spawnSync } from 'node:child_process';

const [backend = 'mock', ...rest] = process.argv.slice(2);
if (!['mock', 'harness'].includes(backend)) {
  console.error('Usage: node scripts/e2e.mjs <mock|harness> [playwright arguments]');
  process.exit(2);
}
const result = spawnSync('npx', ['playwright', 'test', ...rest], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, E2E_BACKEND: backend },
});
process.exit(result.status ?? 1);
