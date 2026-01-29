import { test, expect } from '@playwright/test';
import { registerTestTenant, loginViaUI } from '../helpers/auth';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await page.context().clearCookies();
  });

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    const tenant = await registerTestTenant();

    await loginViaUI(page, tenant.email, tenant.password);

    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    expect(page.url()).toContain('/dashboard');

    // Verify tokens stored
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(accessToken).toBeTruthy();
  });

  test('should show error for wrong password', async ({ page }) => {
    const tenant = await registerTestTenant();

    await loginViaUI(page, tenant.email, 'WrongPassword999');

    // Should show error alert
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });

    // Should stay on login page
    expect(page.url()).toContain('/login');
  });

  test('should show error for non-existent email', async ({ page }) => {
    await loginViaUI(page, `nonexistent-${Date.now()}@test.com`, 'SomePass123');

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('should logout and redirect to login', async ({ page }) => {
    const tenant = await registerTestTenant();

    await loginViaUI(page, tenant.email, tenant.password);
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    // Wait for page to fully load
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 10_000 });

    // Click logout button using JavaScript to bypass any overlays
    const logoutButton = page.locator('button:has-text("Logout")').first();
    await logoutButton.waitFor({ state: 'visible', timeout: 5_000 });

    // Use evaluate to click directly via JS, bypassing pointer event interception
    await logoutButton.evaluate((btn) => (btn as HTMLButtonElement).click());

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 15_000 });

    // Verify tokens cleared
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(accessToken).toBeNull();
  });

  test('should have link to register page', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.getByRole('link', { name: /register/i });
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    await page.waitForURL('**/register');
  });

  test('should have link to forgot password', async ({ page }) => {
    await page.goto('/login');
    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();
    await page.waitForURL('**/forgot-password');
  });
});
