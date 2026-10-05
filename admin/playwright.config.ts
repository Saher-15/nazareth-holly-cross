import { defineConfig, devices } from '@playwright/test';

// Which API the dashboard talks to during the run:
//   E2E_BACKEND=mock     (default) the mock of the contract, mock-api/server.mjs
//   E2E_BACKEND=harness  the REAL Express API over in-memory models, server/test-harness/serve.mjs
// Ports: E2E_PORT (dashboard, 3901), E2E_API_PORT (the API; E2E_MOCK_PORT still works; 3902 mock / 3912 harness).
const HARNESS = process.env.E2E_BACKEND === 'harness';
const APP_PORT = Number(process.env.E2E_PORT ?? 3901);
const API_PORT = Number(process.env.E2E_API_PORT ?? process.env.E2E_MOCK_PORT ?? (HARNESS ? 3912 : 3902));

// End-to-end tests run against a production build (`next start`) and either the local mock of the API contract or
// the real API on in-memory data, the same code visitors get. State-changing tests share one backend, so they run
// one at a time (workers: 1); the global setup resets it and signs in once per role.
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    // Locally you can reuse an installed browser instead of Playwright's: PW_CHANNEL=msedge or chrome.
    channel: process.env.PW_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    HARNESS
      ? {
          command: 'node ../server/test-harness/serve.mjs',
          url: `http://127.0.0.1:${API_PORT}/__harness/health`,
          reuseExistingServer: !process.env.CI,
          env: { HARNESS: '1', HARNESS_PORT: String(API_PORT), HARNESS_ADMIN_PORT: String(APP_PORT), HARNESS_ASSET_BASE: `http://localhost:${APP_PORT}` },
          timeout: 60_000,
        }
      : {
          command: 'node mock-api/server.mjs',
          url: `http://127.0.0.1:${API_PORT}/__mock/health`,
          reuseExistingServer: !process.env.CI,
          env: { MOCK_PORT: String(API_PORT), MOCK_ASSET_BASE: `http://localhost:${APP_PORT}` },
          timeout: 30_000,
        },
    {
      command: `npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/login`,
      reuseExistingServer: !process.env.CI,
      env: { ADMIN_API_URL: `http://127.0.0.1:${API_PORT}` },
      timeout: 120_000,
    },
  ],
});
