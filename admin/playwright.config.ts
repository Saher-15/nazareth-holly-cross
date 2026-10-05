import { defineConfig, devices } from '@playwright/test';

const APP_PORT = Number(process.env.E2E_PORT ?? 3901);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3902);

// End-to-end tests run against a production build (`next start`) and the local mock of the API contract, the same
// code visitors get. State-changing tests share one mock, so they run one at a time (workers: 1); the global setup
// resets the mock and signs in once per role.
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
    {
      command: 'node mock-api/server.mjs',
      url: `http://127.0.0.1:${MOCK_PORT}/__mock/health`,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_PORT: String(MOCK_PORT), MOCK_ASSET_BASE: `http://localhost:${APP_PORT}` },
      timeout: 30_000,
    },
    {
      command: `npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/login`,
      reuseExistingServer: !process.env.CI,
      env: { ADMIN_API_URL: `http://127.0.0.1:${MOCK_PORT}` },
      timeout: 120_000,
    },
  ],
});
