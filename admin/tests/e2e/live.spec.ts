import { expect, test, type Page } from '@playwright/test';
import { API, APP, expectNoAxeViolations, freshIp, HARNESS, noHorizontalScroll, stateFile, USERS, watchProblems } from './helpers';

// Live broadcasting from the dashboard, end to end (docs/LIVE.md), against the mock or the real API (harness), both of
// which talk to a FAKE Cloudflare Stream. The browser gets a fake camera and microphone (Chromium flags) and really runs
// the page's WHIP client: the WHIP request to *.cloudflarestream.com is answered by the test with the SDP answer of a
// second RTCPeerConnection inside the same page, so the WebRTC connection really comes up, on this machine only.
// No STUN server is asked (the init script removes the ICE servers): nothing leaves the machine.

test.use({
  storageState: stateFile('editor'),
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const CONTROL = HARNESS ? '/__harness/live' : '/__mock/live';

async function control(options: { configured?: boolean; failCreate?: boolean }) {
  const res = await fetch(`${API}${CONTROL}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) });
  expect(res.ok).toBeTruthy();
}

/** The public status the website polls (straight from the API under test). */
async function publicStatus(): Promise<{ live: boolean; title?: string; playbackUrl?: string }> {
  return (await fetch(`${API}/live/status`)).json();
}

async function apiAs(role: 'owner' | 'editor') {
  const login = await fetch(`${API}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': freshIp() },
    body: JSON.stringify({ username: USERS[role].username, password: USERS[role].password }),
  });
  const { token } = (await login.json()) as { token: string };
  return (method: string, path: string, body?: unknown) =>
    fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Forwarded-For': freshIp() }, body: body === undefined ? undefined : JSON.stringify(body) });
}

/** Ends whatever is live (as an owner, confirmed), so every test starts with nothing on air. */
async function endEverything() {
  const owner = await apiAs('owner');
  await owner('POST', '/admin/live/stop', { force: true });
}

type FakeCloudflare = { posts: number; deletes: number; offers: string[] };

/** Answers the page's WHIP requests like Cloudflare would (201 + SDP answer + Location), or refuses with `status`. */
async function fakeCloudflare(page: Page, { status = 201 }: { status?: number } = {}): Promise<FakeCloudflare> {
  const calls: FakeCloudflare = { posts: 0, deletes: 0, offers: [] };
  await page.addInitScript(() => {
    // No STUN: the connection stays on this machine.
    const Real = window.RTCPeerConnection;
    class LocalOnly extends Real {
      constructor(config?: RTCConfiguration) {
        super({ ...config, iceServers: [] });
      }
    }
    window.RTCPeerConnection = LocalOnly;
    // The "Cloudflare" side: a receiving peer in the same page.
    (window as unknown as { __fakeWhipAnswer: (offer: string) => Promise<string> }).__fakeWhipAnswer = async (offer: string) => {
      const pc = new RTCPeerConnection();
      const w = window as unknown as { __whipTracks: number; __whipPeers: RTCPeerConnection[] };
      w.__whipPeers = [...(w.__whipPeers ?? []), pc];
      pc.ontrack = () => { w.__whipTracks = (w.__whipTracks ?? 0) + 1; };
      await pc.setRemoteDescription({ type: 'offer', sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const timer = setTimeout(resolve, 2000);
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); }
        });
      });
      return pc.localDescription!.sdp;
    };
  });
  await page.route(/^https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\//, async (route) => {
    const request = route.request();
    const cors = { 'Access-Control-Allow-Origin': APP, 'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, accept', 'Access-Control-Expose-Headers': 'Location' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (request.method() === 'DELETE') {
      calls.deletes += 1;
      return route.fulfill({ status: 200, headers: cors });
    }
    calls.posts += 1;
    expect(request.headers()['content-type']).toBe('application/sdp');
    expect(request.headers().cookie).toBeUndefined(); // credentials: 'omit'
    const offer = request.postData() ?? '';
    calls.offers.push(offer);
    if (status !== 201) return route.fulfill({ status, headers: cors, body: 'refused' });
    const answer = await page.evaluate((sdp) => (window as unknown as { __fakeWhipAnswer: (o: string) => Promise<string> }).__fakeWhipAnswer(sdp), offer);
    return route.fulfill({ status: 201, headers: { ...cors, 'Content-Type': 'application/sdp', Location: '/whip-session/1' }, body: answer });
  });
  page.on('dialog', (dialog) => void dialog.accept()); // "leave the page?" while live
  return calls;
}

test.beforeEach(async () => {
  await control({ configured: true, failCreate: false });
  await endEverything();
});
test.afterAll(async () => {
  await control({ configured: true, failCreate: false });
  await endEverything();
});

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
    await page.getByLabel('Title').fill('Evening prayer at the Basilica');
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

  test('closing the page while live ends the broadcast (keepalive stop)', async ({ page }) => {
    await fakeCloudflare(page);
    await page.goto('/live');
    await page.getByRole('button', { name: 'Turn on camera and microphone' }).click();
    await page.getByLabel('Title').fill('Leaving soon');
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
    await page.getByLabel('Title').fill('Refused');
    await page.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByTestId('live-error')).toContainText('The camera could not be connected to Cloudflare.');
    expect((await publicStatus()).live).toBe(false);
    await expect(page.getByRole('button', { name: 'Go live' })).toBeEnabled();
  });

  test('when Cloudflare cannot prepare an input, nothing goes live', async ({ page }) => {
    await control({ failCreate: true });
    await fakeCloudflare(page);
    await page.goto('/live');
    await page.getByRole('button', { name: 'Turn on camera and microphone' }).click();
    await page.getByLabel('Title').fill('Outage');
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
    const ownerContext = await browser.newContext({ storageState: stateFile('owner') });
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
    const ownerContext = await browser.newContext({ storageState: stateFile('owner') });
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
