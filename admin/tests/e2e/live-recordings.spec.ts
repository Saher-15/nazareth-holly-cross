import { expect, test, type Page } from '@playwright/test';
import { API, APP, expectNoAxeViolations, noHorizontalScroll, stateFile, watchProblems } from './helpers';
import {
  apiAs, cleanRecordingsAndSchedule, control, endEverything, fakeCloudflare, localRecordings, publicStatus, seedRecording, stubMediaRecorder,
} from './live-helpers';

// Recordings of broadcasts and scheduled broadcasts on the Live page (docs/LIVE.md), end to end against the mock or the
// real API (harness), both with a FAKE Cloudflare. The browser's MediaRecorder is replaced by a fake that gives a small
// piece every 250 ms (live-helpers.ts stubMediaRecorder); the upload goes to a tus endpoint answered by the test inside
// the browser (Playwright routes: PATCH, HEAD, with the CORS headers of a real tus server). Nothing reaches Cloudflare.

test.use({
  storageState: stateFile('liveeditor'),
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async () => {
  await control({ configured: true, failCreate: false, failUpload: false });
  await cleanRecordingsAndSchedule();
});
test.afterAll(async () => {
  await control({ configured: true, failCreate: false, failUpload: false });
  await cleanRecordingsAndSchedule();
});

const studio = (page: Page) => page.getByRole('region', { name: 'Studio' });
const recordings = (page: Page) => page.getByTestId('live-recordings');
const schedule = (page: Page) => page.getByTestId('live-schedule');
const row = (section: ReturnType<typeof recordings>, text: string) => section.getByRole('row').filter({ hasText: text });

/** "YYYY-MM-DDTHH:MM" in Nazareth, `ms` from now (what the form's datetime-local field takes). */
function nazarethLocal(msFromNow: number): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(Date.now() + msFromNow)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

async function goLive(page: Page, title: string, { record = true } = {}) {
  await page.getByRole('button', { name: 'Turn on camera and microphone' }).click();
  await expect(page.getByTestId('live-camera')).toBeVisible({ timeout: 15_000 }); // the fake camera can be slow to start on a busy machine
  const recordSwitch = studio(page).getByRole('switch', { name: 'Record this broadcast' });
  await expect(recordSwitch).toHaveAttribute('aria-checked', 'true'); // on by default
  if (!record) {
    await recordSwitch.click();
    await expect(recordSwitch).toHaveAttribute('aria-checked', 'false');
  }
  await studio(page).getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Go live' }).click();
  await expect(page.getByTestId('live-status')).toHaveText(/You are live/, { timeout: 15_000 });
}

async function endBroadcast(page: Page) {
  await page.getByRole('button', { name: 'End broadcast' }).click();
  await page.getByRole('dialog', { name: 'End the broadcast?' }).getByRole('button', { name: 'End broadcast' }).click();
  await expect(page.getByTestId('live-badge')).toHaveCount(0);
}

test.describe('recording a broadcast', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'state-changing flow: run once (the phone runs the page checks below)');
  });

  test('record, end, upload to Cloudflare (tus), processing, ready, publish, rename, preview, delete', async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watchProblems(page);
    const cloudflare = await fakeCloudflare(page);
    await stubMediaRecorder(page);
    await page.goto('/live');
    await goLive(page, 'Vespers recorded');
    await expect(studio(page).getByTestId('live-recording')).toContainText('Recording:');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __chunks: number }).__chunks)).toBeGreaterThan(5);
    // every piece is also in IndexedDB as it arrives (the safety net for a closed tab)
    await expect.poll(async () => (await localRecordings(page))[0]?.pieces ?? 0).toBeGreaterThan(3);

    cloudflare.hold(); // keep the upload in flight to look at it
    await endBroadcast(page);
    const status = page.getByTestId('upload-status');
    await expect(status).toBeVisible();
    await expect(status.getByRole('heading', { name: 'Recording upload' })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: /Upload of “Vespers recorded”/ })).toBeVisible();
    await expect(page.getByTestId('upload-progress-text')).toContainText('%');
    cloudflare.release();
    await expect(status).toHaveAttribute('data-phase', 'done', { timeout: 15_000 });
    await expect(page.getByTestId('upload-announcement')).toContainText('was uploaded');

    // The file went to Cloudflare in tus PATCHes, from byte 0, with the protocol's headers and no cookie.
    const patches = cloudflare.tus.filter((c) => c.method === 'PATCH');
    expect(patches[0].offset).toBe(0);
    for (const p of patches) {
      expect(p.headers['tus-resumable']).toBe('1.0.0');
      expect(p.headers['content-type']).toBe('application/offset+octet-stream');
    }
    const sent = [...cloudflare.received.values()].reduce((a, b) => a + b, 0);
    expect(sent).toBeGreaterThan(5 * 2048);
    // The browser's copy is gone after the upload, and it never held the upload address.
    expect(await localRecordings(page)).toEqual([]);

    // The list: processing, then (Cloudflare finished) ready, picked up by the list's own check every 15 seconds.
    const item = row(recordings(page), 'Vespers recorded');
    await expect(item).toContainText('Processing');
    await expect(item.getByRole('switch', { name: 'Show “Vespers recorded” on the website' })).toBeDisabled();
    const videos = await control({ videoState: 'ready', durationSeconds: 90 });
    expect(videos.videos.some((v) => v.sizeBytes === sent)).toBe(true); // the size told to the API is the size sent
    await expect(item).toContainText('Ready', { timeout: 40_000 });
    await expect(item.getByRole('img', { name: 'Vespers recorded' })).toBeVisible(); // Cloudflare's thumbnail (a local stand-in)
    await expect(item).toContainText('1:30');

    // Publish: the website lists it.
    const publish = item.getByRole('switch', { name: 'Show “Vespers recorded” on the website' });
    await publish.click();
    await expect(publish).toHaveAttribute('aria-checked', 'true');
    await expect(item.getByTestId('rec-published-state')).toHaveText('Published');
    const website = (await (await fetch(`${API}/live/recordings`)).json()) as { items: { title: string }[] };
    expect(website.items.map((i) => i.title)).toContain('Vespers recorded');

    // Rename in place.
    await item.getByRole('button', { name: 'Rename “Vespers recorded”' }).click();
    const input = page.getByRole('textbox', { name: 'New title of “Vespers recorded”' });
    await expect(input).toBeFocused();
    await input.fill('Vespers & psalms, 7 October');
    await input.press('Enter');
    const renamed = row(recordings(page), 'Vespers & psalms, 7 October');
    await expect(renamed).toBeVisible();

    // Preview: Cloudflare's player, loaded only now.
    expect(cloudflare.players).toBe(0);
    await renamed.getByRole('button', { name: 'Preview “Vespers & psalms, 7 October”' }).click();
    const frame = page.locator('iframe[title="Video player: Vespers & psalms, 7 October"]');
    await expect(frame).toHaveAttribute('src', /^https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\/[a-f0-9]{32}\/iframe$/);
    await expect.poll(() => cloudflare.players).toBe(1);
    await page.getByRole('button', { name: 'Close the preview' }).click();

    // Delete, after a confirmation that names it and says Cloudflare's copy goes too.
    await renamed.getByRole('button', { name: 'Delete “Vespers & psalms, 7 October”' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete the recording “Vespers & psalms, 7 October”?' });
    await expect(dialog).toContainText('also deletes the video at Cloudflare');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('The recording was deleted.')).toBeVisible();
    await expect(recordings(page).getByTestId('rec-empty')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('a network failure during the upload is resumed from what Cloudflare has (HEAD)', async ({ page }) => {
    const cloudflare = await fakeCloudflare(page);
    await stubMediaRecorder(page);
    await page.goto('/live');
    await goLive(page, 'Shaky connection');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __chunks: number }).__chunks)).toBeGreaterThan(3);
    cloudflare.failNextPatch();
    await endBroadcast(page);
    await expect(page.getByTestId('upload-status')).toHaveAttribute('data-phase', 'done', { timeout: 20_000 });
    expect(cloudflare.tus.map((c) => c.method)).toEqual(['PATCH', 'HEAD', 'PATCH']);
    expect(cloudflare.tus[2].offset).toBe(0); // Cloudflare had nothing yet
    await expect(row(recordings(page), 'Shaky connection')).toContainText('Processing');
  });

  test('a reload during a recording: the copy in IndexedDB is offered on the next visit and uploads from the start', async ({ page }) => {
    test.setTimeout(90_000);
    const cloudflare = await fakeCloudflare(page);
    await stubMediaRecorder(page);
    await page.goto('/live');
    await goLive(page, 'Interrupted vespers');
    await expect.poll(async () => (await localRecordings(page))[0]?.pieces ?? 0).toBeGreaterThan(4);
    const before = (await localRecordings(page))[0];
    expect(before).toMatchObject({ title: 'Interrupted vespers', state: 'recording', recordingId: null });

    await page.reload(); // the broadcast ends (keepalive stop); the recording stays on this device
    await expect.poll(async () => (await publicStatus()).live, { timeout: 10_000 }).toBe(false);
    const offer = page.getByTestId('unfinished-recordings');
    await expect(offer.getByRole('heading', { name: 'An unfinished recording was found' })).toBeVisible();
    await expect(offer).toContainText('Interrupted vespers');
    await expect(offer).toContainText('MB');
    await expectNoAxeViolations(page, AXE_TAGS);

    await offer.getByRole('button', { name: 'Upload the unfinished recording “Interrupted vespers”' }).click();
    await expect(page.getByTestId('upload-status')).toHaveAttribute('data-phase', 'done', { timeout: 20_000 });
    await expect(offer).toHaveCount(0);
    const sent = [...cloudflare.received.values()].reduce((a, b) => a + b, 0);
    expect(sent).toBeGreaterThanOrEqual(before.sizeBytes);
    expect(cloudflare.tus[0]).toMatchObject({ method: 'PATCH', offset: 0 });
    await expect(row(recordings(page), 'Interrupted vespers')).toContainText('Processing');
    expect(await localRecordings(page)).toEqual([]);
  });

  test('an unfinished recording can be discarded (after a confirmation)', async ({ page }) => {
    await fakeCloudflare(page);
    await stubMediaRecorder(page);
    await page.goto('/live');
    await goLive(page, 'Not wanted');
    await expect.poll(async () => (await localRecordings(page))[0]?.pieces ?? 0).toBeGreaterThan(2);
    await page.reload();
    const offer = page.getByTestId('unfinished-recordings');
    await offer.getByRole('button', { name: 'Discard the unfinished recording “Not wanted”' }).click();
    await page.getByRole('dialog', { name: 'Discard the recording of “Not wanted”?' }).getByRole('button', { name: 'Discard' }).click();
    await expect(offer).toHaveCount(0);
    expect(await localRecordings(page)).toEqual([]);
    await expect(recordings(page).getByTestId('rec-empty')).toBeVisible(); // nothing was ever created at the API
  });

  test('with the switch off, nothing is recorded or uploaded', async ({ page }) => {
    const cloudflare = await fakeCloudflare(page);
    await stubMediaRecorder(page);
    await page.goto('/live');
    await goLive(page, 'Not recorded', { record: false });
    await expect(studio(page).getByTestId('live-recording')).toHaveCount(0);
    await endBroadcast(page);
    await expect(page.getByTestId('upload-status')).toHaveCount(0);
    expect(cloudflare.tus).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __chunks: number }).__chunks)).toBe(0);
  });

  test('Cloudflare refusing an upload address: the upload pauses with Retry, and Retry finishes it', async ({ page }) => {
    const cloudflare = await fakeCloudflare(page);
    await stubMediaRecorder(page);
    await page.goto('/live');
    await goLive(page, 'Retry later');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __chunks: number }).__chunks)).toBeGreaterThan(2);
    await control({ failUpload: true });
    await endBroadcast(page);
    await expect(page.getByTestId('upload-problem')).toContainText('Upload paused: check the connection.');
    await control({ failUpload: false });
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('upload-status')).toHaveAttribute('data-phase', 'done', { timeout: 20_000 });
    expect(cloudflare.received.size).toBe(1);
  });
});

test.describe('scheduled broadcasts', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'state-changing flow: run once');
  });

  test('schedule one in Nazareth time, publish it, go live from it (suggested), end: it is done', async ({ page }) => {
    const problems = watchProblems(page);
    await fakeCloudflare(page);
    await stubMediaRecorder(page);
    await page.goto('/live');
    const when = nazarethLocal(30 * 60_000);
    const form = page.getByTestId('sched-form');
    await expect(form.getByRole('heading', { name: 'Schedule a broadcast' })).toBeVisible();
    await expect(form.getByLabel('Date and time (Nazareth time)')).toBeVisible();

    // The form checks before sending: a title is needed, the time cannot be in the past.
    await form.getByTestId('sched-submit').click();
    await expect(form).toContainText('Write a title of 1 to 120 characters.');
    await expect(form).toContainText('Choose a date and a time.');
    await form.getByLabel('Title').fill('Evening vespers & choir');
    await form.getByLabel('Date and time (Nazareth time)').fill(nazarethLocal(-24 * 3600_000));
    await form.getByTestId('sched-submit').click();
    await expect(form).toContainText('That time has already passed.');

    await form.getByLabel('Date and time (Nazareth time)').fill(when);
    await form.getByLabel('Description (optional)').fill('With the choir of the Basilica');
    const publish = form.getByRole('switch', { name: 'Publish on the website' });
    await expect(publish).toHaveAttribute('aria-checked', 'false'); // a draft by default
    await publish.click();
    await form.getByTestId('sched-submit').click();
    await expect(page.getByText('The broadcast was scheduled.')).toBeVisible();

    const item = row(schedule(page), 'Evening vespers & choir');
    await expect(item).toContainText('Scheduled');
    await expect(item).toContainText('Published');
    await expect(item).toContainText(when.slice(11)); // shown in Nazareth time
    const editor = await apiAs('editor');
    // (the API stores text HTML-escaped, docs/ADMIN.md 4.2)
    const listed = (await (await editor('GET', '/admin/live/schedule')).json()) as { items: { title: string; startsAtLocal: string; published: boolean }[] };
    expect(listed.items.find((i) => i.title === 'Evening vespers &amp; choir')).toMatchObject({ startsAtLocal: when, published: true });
    const website = (await (await fetch(`${API}/live/schedule`)).json()) as { items: { title: string }[] };
    expect(website.items.map((i) => i.title)).toContain('Evening vespers &amp; choir');

    // Go live: the scheduled broadcast within two hours is suggested, and fills the title.
    await page.getByRole('button', { name: 'Turn on camera and microphone' }).click();
    const fulfils = studio(page).getByLabel('Fulfils scheduled broadcast');
    await expect(fulfils.locator('option:checked')).toHaveText(/^Evening vespers & choir \(/);
    await expect(studio(page).getByLabel('Title')).toHaveValue('Evening vespers & choir');
    await studio(page).getByRole('switch', { name: 'Record this broadcast' }).click(); // no recording needed here
    await page.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByTestId('live-status')).toHaveText(/You are live/, { timeout: 15_000 });
    await expect(item).toContainText('Live now');
    expect((await publicStatus()).title).toBe('Evening vespers &amp; choir'); // stored escaped; the website decodes it

    await endBroadcast(page);
    await expect(item).toContainText('Done');
    expect(problems).toEqual([]);
  });

  test('edit, unpublish, cancel, restore and delete a scheduled broadcast', async ({ page }) => {
    const editor = await apiAs('editor');
    const created = await editor('POST', '/admin/live/schedule', { title: 'Feast day', startsAtLocal: nazarethLocal(3 * 24 * 3600_000), published: true });
    expect(created.status).toBe(201);
    await page.goto('/live');
    const item = row(schedule(page), 'Feast day');
    await expect(item).toContainText('Published');

    await item.getByRole('button', { name: 'Edit “Feast day”' }).click();
    const form = page.getByTestId('sched-form');
    await expect(form.getByRole('heading', { name: 'Edit “Feast day”' })).toBeFocused();
    const later = nazarethLocal(4 * 24 * 3600_000);
    await form.getByLabel('Title').fill('Feast day vespers');
    await form.getByLabel('Date and time (Nazareth time)').fill(later);
    await form.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('The changes were saved.')).toBeVisible();
    const edited = row(schedule(page), 'Feast day vespers');
    await expect(edited).toContainText(later.slice(11));
    await expect(form.getByRole('heading', { name: 'Schedule a broadcast' })).toBeVisible(); // back to a new one

    await edited.getByRole('button', { name: 'Unpublish “Feast day vespers”' }).click();
    await expect(edited).toContainText('Draft');
    await edited.getByRole('button', { name: 'Cancel “Feast day vespers”' }).click();
    await page.getByRole('dialog', { name: 'Cancel “Feast day vespers”?' }).getByRole('button', { name: 'Cancel the broadcast' }).click();
    await expect(edited).toContainText('Cancelled');
    await edited.getByRole('button', { name: 'Restore “Feast day vespers”' }).click();
    await expect(edited).toContainText('Scheduled');
    await edited.getByRole('button', { name: 'Delete “Feast day vespers”' }).click();
    await page.getByRole('dialog', { name: 'Delete “Feast day vespers”?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('The scheduled broadcast was deleted.')).toBeVisible();
    await expect(schedule(page).getByTestId('sched-empty')).toBeVisible();
  });
});

test.describe('the Live page with recordings and a schedule (desktop and phone)', () => {
  test('accessible (WCAG 2.2 AA), no sideways scroll, no CSP problem; thumbnails only from Cloudflare\'s host', async ({ page }) => {
    const problems = watchProblems(page);
    const cloudflare = await fakeCloudflare(page);
    await seedRecording('Sunday mass', { publish: true });
    await seedRecording('Rosary evening');
    const editor = await apiAs('editor');
    await editor('POST', '/admin/live/schedule', { title: 'Christmas vigil', description: 'Live from the Basilica', startsAtLocal: nazarethLocal(5 * 24 * 3600_000), published: true });
    await editor('POST', '/admin/live/schedule', { title: 'Draft broadcast', startsAtLocal: nazarethLocal(6 * 24 * 3600_000) });
    await page.goto('/live');
    await expect(page.getByRole('heading', { name: 'Recordings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scheduled broadcasts' })).toBeVisible();
    await expect(row(recordings(page), 'Sunday mass')).toContainText('Published');
    await expect(page.getByTestId('rec-storage')).toContainText(/Stored: \d+ of 1,000 minutes \(about \$\d+\.\d\d a month at \$5 per 1,000 minutes\)/);
    await expect(row(recordings(page), 'Sunday mass').getByRole('img', { name: 'Sunday mass' })).toBeVisible();
    expect(cloudflare.thumbnails).toBeGreaterThan(0);
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page, AXE_TAGS);
    expect(problems).toEqual([]);
  });

  test('in Hebrew (RTL): the recordings and the schedule read right to left', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'once');
    await context.addCookies([{ name: 'nhc_admin_lang', value: 'he', url: APP }]);
    await fakeCloudflare(page);
    await seedRecording('תפילת ערב', { publish: false });
    const editor = await apiAs('editor');
    await editor('POST', '/admin/live/schedule', { title: 'משמרת חג המולד', startsAtLocal: nazarethLocal(2 * 24 * 3600_000) });
    await page.goto('/live');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'הקלטות' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'שידורים מתוכננים' })).toBeVisible();
    await expect(page.getByTestId('sched-form').getByLabel('תאריך ושעה (שעון נצרת)')).toBeVisible();
    await expect(row(recordings(page), 'תפילת ערב')).toContainText('מוכנה');
    await expect(row(schedule(page), 'משמרת חג המולד')).toContainText('טיוטה');
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page, AXE_TAGS);
  });
});

test.describe('roles', () => {
  test.use({ storageState: stateFile('viewer') });
  test('a viewer gets Forbidden, and the proxy\'s recording and schedule routes answer 403', async ({ page }) => {
    await page.goto('/live');
    await expect(page.getByRole('heading', { level: 1, name: 'You do not have access to this' })).toBeVisible();
    await expect(page.getByTestId('live-recordings')).toHaveCount(0);
    for (const path of ['/api/proxy/live/recordings', '/api/proxy/live/schedule']) {
      expect((await page.request.get(path)).status(), path).toBe(403);
    }
    const created = await page.request.post('/api/proxy/live/schedule', { headers: { Origin: APP }, data: { title: 'x', startsAtLocal: nazarethLocal(3600_000) } });
    expect(created.status()).toBe(403);
    await endEverything();
  });
});
