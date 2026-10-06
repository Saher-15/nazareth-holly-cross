// Takes the screenshots used in docs/ADMIN-UI.md (and for design review): the app and the mock API must be running
//   npm run build && ADMIN_API_URL=http://127.0.0.1:3902 npx next start -p 3901   +   npm run dev:mock
//   PW_CHANNEL=msedge node scripts/screenshots.mjs [outDir] [docsDir]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const APP = process.env.APP_URL ?? 'http://localhost:3901';
const out = process.argv[2] ?? path.resolve('screenshots');
const docs = process.argv[3] ?? '';
const channel = process.env.PW_CHANNEL || undefined;

const SIZES = [
  { name: 'desktop', viewport: { width: 1366, height: 800 }, isMobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true },
];

const SHOTS = [
  { name: 'login', path: '/login', anon: true },
  { name: 'dashboard', path: '/' },
  { name: 'orders', path: '/orders' },
  { name: 'order-detail', path: '/orders?status=pending', open: 'first-order' },
  { name: 'candles', path: '/candles' },
  { name: 'products', path: '/products' },
  { name: 'products-grid', path: '/products?view=grid' },
  { name: 'product-edit', path: '/products', click: 'first-product' },
  { name: 'users', path: '/users' },
  { name: 'audit', path: '/audit' },
  { name: 'settings', path: '/settings' },
  { name: 'dashboard-he', path: '/', lang: 'he' },
];

fs.mkdirSync(out, { recursive: true });
if (docs) fs.mkdirSync(docs, { recursive: true });

const browser = await chromium.launch({ channel });
for (const size of SIZES) {
  for (const shot of SHOTS) {
    const context = await browser.newContext({ viewport: size.viewport, isMobile: size.isMobile, hasTouch: size.isMobile, deviceScaleFactor: 1, baseURL: APP });
    if (!shot.anon) {
      const login = await context.request.post('/api/session/login', { data: { username: 'owner', password: 'Owner-Mock-Pass-1' }, headers: { Origin: APP } });
      if (!login.ok()) throw new Error(`login failed: ${login.status()}`);
    }
    if (shot.lang) await context.addCookies([{ name: 'nhc_admin_lang', value: shot.lang, url: APP }]);
    const page = await context.newPage();
    await page.goto(shot.path, { waitUntil: 'networkidle' });
    if (shot.open === 'first-order') {
      await page.locator('tbody tr').first().getByRole('link').first().click();
      await page.locator('dialog.drawer[open]').waitFor();
      await page.waitForTimeout(400);
    }
    if (shot.click === 'first-product') {
      await page.locator('tbody tr').first().getByRole('link').first().click();
      await page.waitForURL(/\/products\/[^/]+$/);
      await page.waitForLoadState('networkidle');
    }
    await page.waitForTimeout(250);
    const file = `${shot.name}-${size.name}.png`;
    await page.screenshot({ path: path.join(out, file), fullPage: !shot.open && !size.isMobile });
    if (docs && !shot.lang) fs.copyFileSync(path.join(out, file), path.join(docs, file));
    await context.close();
  }
}
await browser.close();
console.log(`screenshots written to ${out}`);
