import { expect, test, type Page } from '@playwright/test';
import { APP, expectNoAxeViolations, noHorizontalScroll, stateFile, watchProblems } from './helpers';
import { apiAs, cleanRecordingsAndSchedule, control, endEverything, fakeCloudflare, publicStatus } from './live-helpers';

// Live broadcasting from the dashboard, end to end (docs/LIVE.md), against the mock or the real API (harness), both of
// which talk to a FAKE Cloudflare Stream. The browser gets a fake camera and microphone (Chromium flags) and really runs
// the page's WHIP client: the WHIP request to *.cloudflarestream.com is answered by the test with the SDP answer of a
// second RTCPeerConnection inside the same page, so the WebRTC connection really comes up, on this machine only.
// No STUN server is asked (the init script removes the ICE servers): nothing leaves the machine. The recording is ON by
// default: here the browser's REAL MediaRecorder records (through the page's canvas + WebAudio mixer) and the upload goes
// to the fake Cloudflare tus endpoint of live-helpers.ts (live-recordings.spec.ts tests recordings in detail).

test.use({
  storageState: stateFile('liveeditor'),
  // Its own client address (the app forwards it with ADMIN_TRUST_XFF=1): the Live page asks the API often, and the
  // API's per-address limit (1000 per 15 minutes on /admin) is shared by the whole suite otherwise.
  extraHTTPHeaders: { 'X-Forwarded-For': '10.78.0.1' },
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

test.beforeEach(async () => {
  await control({ configured: true, failCreate: false });
  await endEverything();
});
test.afterAll(async () => {
  await control({ configured: true, failCreate: false });
  await cleanRecordingsAndSchedule();
});

/** The studio's own title field (the schedule form below has a "Title" too). */
const studioTitle = (page: Page) => page.getByRole('region', { name: 'Studio' }).getByLabel('Title');

test.describe('the Live page renders (desktop and phone)', () => {
  test('studio, rules and history: accessible, no sideways scroll, no CSP problem', async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto('/live');
    await expect(page.getByRole('heading', { level: 1, name: 'Live broadcast' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn on camera and microphone' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Good to know' })).toBeVisible();
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page);
    expect(problems).toEqual([]);
  });

  test('the preview with the camera on is accessible too, in Hebrew (RTL)', async ({ page, context }) => {
    await context.addCookies([{ name: 'nhc_admin_lang', value: 'he', url: APP }]);
    await fakeCloudflare(page);
    await page.goto('/live');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByRole('button', { name: 'הפעלת מצלמה ומיקרופון' }).click();
    await expect(page.getByTestId('live-camera')).toBeVisible();
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });
});

test.describe('broadcasting', () => {
  // The whole flow also runs on the phone (Pixel 7 emulation): that is how most broadcasts will be made.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' && !testInfo.title.startsWith('camera on, go live'), 'state-changing flow: run once');
  });

  test('camera on, go live, the website says live, mute, end: the whole flow', async ({ page }, testInfo) => {
    const problems = watchProblems(page);
    const cloudflare = await fakeCloudflare(page);
    // From the dashboard through the menu: the link is a full page load, so the camera is allowed on /live.
    await page.goto('/');
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Live broadcast' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Live broadcast' })).toBeVisible();

    await page.getByRole('button', { name: 'Turn on camera and microphone' }).click();
    const preview = page.getByTestId('live-preview');
    await expect.poll(() => preview.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
    await expect(page.getByLabel('Camera', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Microphone', { exact: true })).toBeVisible();

    // A title is required.
    await page.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByText('Write a title for the broadcast.')).toBeVisible();
    await studioTitle(page).fill('Evening prayer at the Basilica');
    await page.getByRole('button', { name: 'Go live' }).click();

    await expect(page.getByTestId('live-badge')).toBeVisible();
    await expect(page.getByTestId('live-status')).toHaveText('You are live. Viewers can watch on the website now.', { timeout: 15_000 });
    expect(await page.evaluate(() => (window as unknown as { __whipTracks?: number }).__whipTracks)).toBe(2); // video and audio arrived
    expect(cloudflare.posts).toBe(1);
    expect(cloudflare.offers[0]).toMatch(/a=sendonly/);
    await expect(page.getByTestId('live-elapsed')).toHaveText(/^0:0[1-9]$/, { timeout: 5000 });

    const status = await publicStatus();
    expect(status).toMatchObject({ live: true, title: 'Evening prayer at the Basilica' });
    expect(status.playbackUrl).toMatch(/^https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\/[a-f0-9]{32}\/iframe$/);

    const mute = page.getByRole('button', { name: 'Mute microphone' });
    await mute.click();
    await expect(page.getByRole('button', { name: 'Unmute microphone' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('live-muted')).toBeVisible();
    expect(await preview.evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream).getAudioTracks()[0].enabled)).toBe(false);

    await page.getByRole('button', { name: 'End broadcast' }).click();
    const dialog = page.getByRole('dialog', { name: 'End the broadcast?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'End broadcast' }).click();
    await expect(page.getByText('The broadcast has ended.').first()).toBeVisible();
    await expect(page.getByTestId('live-badge')).toHaveCount(0);
    expect((await publicStatus()).live).toBe(false);
    expect(cloudflare.deletes).toBe(1); // the WHIP session was ended too
    await expect(page.getByRole('region', { name: 'Recent broadcasts' })).toContainText('Evening prayer at the Basilica');
    expect(problems).toEqual([]);
  });

  test('opening another dashboard page while live keeps the broadcast on, with a bar to come back or end it', async ({ browser }, testInfo) => {
    // As `editor`, not `liveeditor`: this walk through several pages would use up the live specs' request budget.
    const context = await browser.newContext({ storageState: stateFile('editor'), permissions: ['camera', 'microphone'], extraHTTPHeaders: { 'X-Forwarded-For': '10.78.0.2' } });
    const page = await context.newPage();
    const problems = watchProblems(page);
    const cloudflare = await fakeCloudflare(page);
    await page.goto('/live');
    await page.getByRole('button', { name: 'Turn on camera and microphone' }).click();
    await studioTitle(page).fill('Stays on air');
    await page.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByTestId('live-status')).toHaveText(/You are live/, { timeout: 15_000 });

    // The menu: Orders. No reload, no question, the broadcast goes on and a bar shows it.
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Orders' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    const bar = page.getByTestId('live-bar');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('Stays on air');
    await expect(page.getByTestId('live-bar-elapsed')).toHaveText(/^\d+:\d\d$/);
    await page.waitForTimeout(1500);
    expect((await publicStatus()).live).toBe(true);
    expect(cloudflare.deletes).toBe(0);
    // The recording keeps being fed: its <video> plays inside the bar now.
    expect(await bar.locator('video').evaluate((v: HTMLVideoElement) => !v.paused && v.videoWidth > 0)).toBe(true);
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page);

    // A search on the list navigates inside the tab too.
    await page.getByRole('searchbox', { name: 'Search orders' }).fill('zzz');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/q=zzz/);
    await expect(bar).toBeVisible();

    // Back to the studio from the bar: still live, the clock still running.
    await page.getByTestId('live-bar-studio').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Live broadcast' })).toBeVisible();
    await expect(page.getByTestId('live-badge')).toBeVisible();
    await expect(bar).toHaveCount(0);
    expect(await page.getByTestId('live-preview').evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);

    // Away once more: signing out asks first (staying keeps the broadcast), then end it from the bar.
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Products' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
    await page.getByTestId('sign-out').click();
    const ask = page.getByRole('dialog', { name: 'You are live. Sign out?' });
    await ask.getByRole('button', { name: 'Cancel' }).click();
    expect((await publicStatus()).live).toBe(true);
    await page.getByTestId('live-bar-stop').click();
    await page.getByRole('dialog', { name: 'End the broadcast?' }).getByRole('button', { name: 'End broadcast' }).click();
    await expect.poll(async () => (await publicStatus()).live).toBe(false);
    expect(cloudflare.deletes).toBe(1);
    // The camera is off once the broadcast ended away from the studio.
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('video')].some((v) => (v.srcObject as MediaStream | null)?.active))).toBe(false);
    expect(problems).toEqual([]);
    await context.close();
  });

  test('closing the page while live ends the broadcast (keepalive stop)', async ({ page }) => {
    await fakeCloudflare(page);
    await page.goto('/live');
    await page.getByRole('button', { name: 'Turn on camera and microphone' }).click();
    await studioTitle(page).fill('Leaving soon');
    await page.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByTestId('live-status')).toHaveText(/You are live/, { timeout: 15_000 });
    expect((await publicStatus()).live).toBe(true);
    await page.goto('/orders');
    await expect.poll(async () => (await publicStatus()).live, { timeout: 10_000 }).toBe(false);
  });

  test('when Cloudflare refuses the camera, the session is ended at once and the page says what to do', async ({ page }) => {
    await fakeCloudflare(page, { status: 403 });
    await page.goto('/live');
    await page.getByRole('button', { name: 'Turn on camera and microphone' }).click();
    await studioTitle(page).fill('Refused');
    await page.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByTestId('live-error')).toContainText('The camera could not be connected to Cloudflare.');
    expect((await publicStatus()).live).toBe(false);
    await expect(page.getByRole('button', { name: 'Go live' })).toBeEnabled();
    // ... and the history says it failed, not that it ended (review 04 finding 16)
    await expect(page.getByRole('region', { name: 'Recent broadcasts' }).getByRole('row', { name: /Refused/ })).toContainText('Failed');
  });

  test('when Cloudflare cannot prepare an input, nothing goes live', async ({ page }) => {
    await control({ failCreate: true });
    await fakeCloudflare(page);
    await page.goto('/live');
    await page.getByRole('button', { name: 'Turn on camera and microphone' }).click();
    await studioTitle(page).fill('Outage');
    await page.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByTestId('live-error')).toContainText('The broadcast could not be started. Try again in a moment.');
    expect((await publicStatus()).live).toBe(false);
  });

  test('a refused camera permission is explained', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    });
    await page.goto('/live');
    await page.getByRole('button', { name: 'Turn on camera and microphone' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Access to the camera or microphone was refused' })).toBeVisible();
  });

  test('someone else\'s broadcast: an editor waits, an owner can end it after confirming', async ({ page, browser }) => {
    const owner = await apiAs('owner');
    expect((await owner('POST', '/admin/live/start', { title: 'Owner on air' })).status).toBe(201);

    await page.goto('/live');
    const other = page.getByTestId('live-other');
    await expect(other).toContainText('Owner on air');
    await expect(other.getByRole('button')).toHaveCount(0); // an editor cannot end the owner's broadcast
    await expect(page.getByRole('button', { name: 'Turn on camera and microphone' })).toBeDisabled();

    // a second owner account would be needed to see "force"; the owner who started it sees an ordinary end button
    const ownerContext = await browser.newContext({ storageState: stateFile('liveowner') });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto('/live');
    await ownerPage.getByTestId('live-end-other').click();
    await ownerPage.getByRole('dialog').getByRole('button', { name: 'End broadcast' }).click();
    await expect(ownerPage.getByText('The broadcast has ended.').first()).toBeVisible();
    expect((await publicStatus()).live).toBe(false);
    await ownerContext.close();
  });

  test('an owner ends an editor\'s forgotten broadcast with "End this broadcast"', async ({ browser }) => {
    const editor = await apiAs('editor');
    expect((await editor('POST', '/admin/live/start', { title: 'Forgotten' })).status).toBe(201);
    const ownerContext = await browser.newContext({ storageState: stateFile('liveowner') });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto('/live');
    await ownerPage.getByRole('button', { name: 'End this broadcast' }).click();
    const dialog = ownerPage.getByRole('dialog', { name: 'End a broadcast someone else started?' });
    await dialog.getByRole('button', { name: 'End this broadcast' }).click();
    await expect.poll(async () => (await publicStatus()).live).toBe(false);
    await expect(ownerPage.getByRole('region', { name: 'Recent broadcasts' })).toContainText('Ended by an owner');
    await ownerContext.close();
  });

  test('not configured: the page says an owner must set it up, and nothing can start', async ({ page }) => {
    await control({ configured: false });
    await page.goto('/live');
    await expect(page.getByTestId('live-not-configured')).toContainText('Live broadcasting is not set up yet');
    await expect(page.getByRole('button', { name: 'Go live' })).toHaveCount(0);
  });
});

test.describe('roles', () => {
  test.use({ storageState: stateFile('viewer') });
  test('a viewer has no Live entry and the page is forbidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Live broadcast' })).toHaveCount(0);
    await page.goto('/live');
    await expect(page.getByRole('heading', { level: 1, name: 'You do not have access to this' })).toBeVisible();
  });
});
