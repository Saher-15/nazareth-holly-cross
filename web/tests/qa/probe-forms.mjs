// Form edge cases against a mocked API (nothing leaves localhost). QA_BASE=... PW_CHANNEL=msedge node tests/qa/probe-forms.mjs
import { chromium } from '@playwright/test';
const BASE = process.env.QA_BASE ?? 'http://localhost:3603';
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const out = (...a) => console.log(...a);

async function ctxWithMocks(posts, { status = 200, delay = 0 } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.host === new URL(BASE).host) return r.continue();
    if (r.request().method() === 'POST') {
      posts.push({ path: u.pathname, body: r.request().postData() });
      if (delay) await new Promise((x) => setTimeout(x, delay));
      return r.fulfill({ status, contentType: 'application/json', body: '"ok"' });
    }
    return r.abort();
  });
  return ctx;
}

// reviews: emoji, RTL, very long, double submit
{
  const posts = [];
  const ctx = await ctxWithMocks(posts, { delay: 500 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/en/reviews');
  await page.locator('input[name=fullName]').fill('מריה 🙏 Haddad');
  await page.locator('input[name=place]').fill('ישראל');
  await page.locator('textarea[name=msg]').fill('Beautiful 🕯️ ' + 'x'.repeat(50));
  const submit = page.locator('form button[type=submit]');
  await submit.dblclick();
  await page.waitForTimeout(1500);
  out('reviews double-click POST count =', posts.length, posts[0] && JSON.stringify(JSON.parse(posts[0].body)).slice(0, 120));
  await ctx.close();
}
// reviews: 1000+ chars in textarea is capped
{
  const posts = [];
  const ctx = await ctxWithMocks(posts);
  const page = await ctx.newPage();
  await page.goto(BASE + '/en/reviews');
  const ta = page.locator('textarea');
  await ta.fill('y'.repeat(1500));
  out('textarea length after pasting 1500 =', (await ta.inputValue()).length);
  await ctx.close();
}
// candle: emoji in names + prayer, full flow to payment step
{
  const posts = [];
  const ctx = await ctxWithMocks(posts);
  const page = await ctx.newPage();
  await page.route('https://www.paypal.com/sdk/**', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto(BASE + '/en/candle');
  await page.getByText('Basilica of the Annunciation', { exact: true }).click();
  await page.getByLabel('First name').fill('Ánna 🌹');
  await page.getByLabel('Last name').fill('O\'Neil-Smith');
  await page.getByLabel('Your email').fill('Anna+test@Example.com');
  await page.getByLabel('Confirm email address').fill('anna+test@example.com');
  await page.getByLabel('Your prayer').fill('שלום עליכם 🙏\nline two');
  await page.locator('form button[type=submit]').click();
  await page.waitForTimeout(800);
  out('candle after valid details, headings:', await page.locator('h2').allTextContents());
  await ctx.close();
}
// donate: odd amounts
{
  const ctx = await ctxWithMocks([]);
  const page = await ctx.newPage();
  await page.route('https://www.paypal.com/sdk/**', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  for (const amount of ['0', '1', '5000', '5000.01', '1e3', '25,50', '٢٥', ' 7 ', '-5', '12.345', '99999999', '<b>1</b>']) {
    await page.goto(BASE + '/en/donate');
    await page.getByLabel('Your name').fill('Test').catch(async () => page.getByLabel(/name/i).first().fill('Test'));
    await page.getByText(/other/i).first().click();
    await page.getByLabel(/amount/i).fill(amount).catch(() => {});
    await page.locator('form button[type=submit]').click();
    await page.waitForTimeout(250);
    const err = await page.locator('[id$="error"], .ui-error, [role=alert]').allTextContents();
    const step = await page.locator('[aria-current="step"]').allTextContents();
    out(`donate amount "${amount}" -> step=${step.join('|').trim()} errors=${err.join('|').slice(0, 80)}`);
  }
  await ctx.close();
}
await b.close();
