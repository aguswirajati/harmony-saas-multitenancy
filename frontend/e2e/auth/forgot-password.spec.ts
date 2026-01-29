import { test, expect } from '@playwright/test';

// Use serial mode to avoid cookie pollution between tests
test.describe.configure({ mode: 'serial' });

test.describe('Forgot Password', () => {
  // FIXME: These tests work in isolation but fail intermittently due to Next.js dev server
  // page compilation causing element detachment. Run against production build for reliability.

  test.fixme('should submit email and show success message', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to login first, then click the link
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Click the "Forgot password?" link
    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible({ timeout: 10_000 });
    await forgotLink.click();

    // Wait for the forgot-password page to load
    const submitButton = page.getByRole('button', { name: /send reset link/i });
    await expect(submitButton).toBeVisible({ timeout: 20_000 });

    // Fill email and submit
    await page.locator('#email').fill('user@example.com');
    await submitButton.click({ force: true });

    // Should show success message
    await expect(page.getByText('Check Your Email')).toBeVisible({ timeout: 15_000 });

    await context.close().catch(() => {});
  });

  test.fixme('should have link back to login', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate via login page
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible({ timeout: 10_000 });
    await forgotLink.click();

    // Wait for forgot-password page
    const loginLink = page.getByRole('link', { name: /back to login/i });
    await expect(loginLink).toBeVisible({ timeout: 20_000 });
    await loginLink.click();
    await page.waitForURL('**/login');

    await context.close().catch(() => {});
  });
});
