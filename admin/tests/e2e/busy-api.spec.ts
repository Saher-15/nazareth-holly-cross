import { expect, test } from '@playwright/test';
import { API, APP, HARNESS, signIn, USERS } from './helpers';

// When the API is busy (429) while the dashboard checks who is signed in, the page shows a translated message with
// the wait, never Next's bare error page. (The control that makes the API busy exists in the mock only.)
test.describe('a busy API', () => {
  test.skip(HARNESS, 'the busy-API switch is a control of the mock API');

  test('shows a "try again in N minutes" state instead of a crash, and recovers', async ({ page }) => {
    await signIn(page, USERS.owner);
    await page.goto(`${APP}/`);
    await expect(page.locator('h1').first()).toBeVisible();

    await fetch(`${API}/__mock/busy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: 1 }) });
    await page.reload();
    await expect(page.locator('.state--error')).toContainText('Too many requests. Try again in 2 minutes.');
    await expect(page.getByText('Application error')).toHaveCount(0);

    await page.getByRole('link', { name: 'Try again' }).click();
    await expect(page.locator('.state--error')).toHaveCount(0);
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
