import { expect, test, request as pwRequest } from '@playwright/test';
import { APP, code, expectNoAxeViolations, freshIp, loginUi, noHorizontalScroll, USERS, watchProblems } from './helpers';

test.describe('sign-in', () => {
  test('a signed-out visitor is sent to the login page and back after signing in', async ({ page }) => {
    await page.goto('/orders?status=pending');
    await expect(page).toHaveURL(/\/login\?next=%2Forders%3Fstatus%3Dpending$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await page.getByLabel('Username').fill(USERS.editor.username);
    await page.getByLabel('Password', { exact: true }).fill(USERS.editor.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/orders\?status=pending$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  });

  test('the login page is accessible and usable on the viewport', async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto('/login');
    await expect(page.getByLabel('Username')).toBeFocused();
    await noHorizontalScroll(page);
    await expectNoAxeViolations(page);
    expect(problems).toEqual([]);
  });

  test('wrong credentials: one generic message, whichever part was wrong', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'state-light but kept to one project to stay under the rate limit');
    const messages: string[] = [];
    for (const attempt of [
      { username: 'owner', password: 'definitely-wrong-password' },
      { username: 'no-such-user', password: 'definitely-wrong-password' },
    ]) {
      await page.goto('/login');
      await page.getByLabel('Username').fill(attempt.username);
      await page.getByLabel('Password', { exact: true }).fill(attempt.password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      const alert = page.getByRole('alert').filter({ hasText: 'Wrong username or password.' });
      await expect(alert).toBeVisible();
      messages.push((await alert.textContent()) ?? '');
      await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
      await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    }
    expect(new Set(messages).size).toBe(1);
    await expect(page).toHaveURL(/\/login/);
  });

  test('password show/hide and the Caps Lock hint', async ({ page }) => {
    await page.goto('/login');
    const password = page.getByLabel('Password', { exact: true });
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(password).toHaveAttribute('type', 'password');
    await password.focus();
    // Simulate a keyboard event carrying the Caps Lock modifier state.
    await password.evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', modifierCapsLock: true, bubbles: true }));
    });
    await expect(page.getByText('Caps Lock is on.')).toBeVisible();
  });

  test('five wrong passwords lock the account: even the right password then fails, with the same message', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'locks a mock account for 15 minutes: run once');
    const api = await pwRequest.newContext({ baseURL: APP, extraHTTPHeaders: { Origin: APP } });
    for (let i = 0; i < 5; i += 1) {
      // Each attempt from its own address (the app forwards X-Forwarded-For): the API's sign-in limit counts 5 failures per
      // address and name, which would otherwise answer 429 before the account lock can be seen.
      const res = await api.post('/api/session/login', { data: { username: USERS.locktest.username, password: `wrong-password-${i}` }, headers: { 'X-Forwarded-For': freshIp() } });
      expect(res.status()).toBe(401);
    }
    await api.dispose();
    await loginUi(page, USERS.locktest);
    await expect(page.getByRole('alert').filter({ hasText: 'Wrong username or password.' })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('too many attempts show the rate-limit message', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'uses up the rate limit of one made-up user name: run once');
    const api = await pwRequest.newContext({ baseURL: APP, extraHTTPHeaders: { Origin: APP } });
    let last = 0;
    for (let i = 0; i < 12 && last !== 429; i += 1) {
      last = (await api.post('/api/session/login', { data: { username: 'rate-limit-probe', password: 'nope-nope-nope' } })).status();
    }
    expect(last).toBe(429);
    await api.dispose();
    await loginUi(page, { username: 'rate-limit-probe', password: 'nope-nope-nope' });
    await expect(page.getByRole('alert').filter({ hasText: /Too many attempts/ })).toBeVisible();
  });

  test('an empty sign-in form says what is missing and focuses it (review 03 finding 16)', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Enter your username or e-mail address.' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeFocused();
    await page.getByLabel('Username').fill('someone');
    await page.getByLabel('Username').press('Enter');
    await expect(page.getByRole('alert').filter({ hasText: 'Enter your password.' })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
    await page.goto('/forgot-password');
    await page.getByRole('button', { name: 'Send the link' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Enter the e-mail address of your account.' })).toBeVisible();
  });

  test('two-factor account: the code step appears, a wrong code fails, the right one signs in', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one wrong code counts toward the lockout: run once');
    await loginUi(page, USERS.secure);
    await expect(page.getByLabel('Authentication code')).toBeVisible();
    await expect(page.getByLabel('Authentication code')).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: 'Second step: the code from your app' })).toBeVisible();
    // An empty code is named, not a silently disabled button (review 03 finding 16).
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Enter the 6-digit code.' })).toBeVisible();
    await expect(page.getByLabel('Authentication code')).toBeFocused();

    await page.getByLabel('Authentication code').fill('000000');
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Wrong username, password or code.' })).toBeVisible();

    await page.getByLabel('Authentication code').fill(code(USERS.secure.secret));
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  });

  test('two-factor step can go back, and a bad code format never reaches the server', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once');
    await loginUi(page, USERS.secure);
    await page.getByLabel('Authentication code').fill('12ab34');
    await expect(page.getByLabel('Authentication code')).toHaveValue('1234');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByLabel('Username')).toBeVisible();
  });
});

test.describe('sign-out and session', () => {
  test('signing out revokes the token on the server and returns to the login page', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once');
    await loginUi(page, USERS.viewer);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'nhc_admin');
    expect(session).toBeTruthy();

    await page.getByTestId('sign-out').click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await context.cookies()).find((c) => c.name === 'nhc_admin')).toBeUndefined();

    // The old token, replayed by someone who copied it, is dead at once.
    const api = await pwRequest.newContext({ baseURL: APP });
    await api.storageState();
    const replay = await api.get('/api/proxy/auth/me', { headers: { Cookie: `nhc_admin=${session!.value}` } });
    expect(replay.status()).toBe(401);
    await api.dispose();
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('a dead session shows the expired message and clears the cookie', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once');
    await context.addCookies([{ name: 'nhc_admin', value: 'aaaa.eyJleHAiOjk5OTk5OTk5OTl9.cccc', url: APP }]);
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login\?reason=expired/);
    await expect(page.getByText('Your session ended. Please sign in again.')).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === 'nhc_admin')).toBeUndefined();
  });
});
