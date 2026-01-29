import { test, expect } from '@playwright/test';
import { registerTestTenant, setAuthTokens } from '../helpers/auth';

test.describe('Dashboard Navigation', () => {
  let tenant: Awaited<ReturnType<typeof registerTestTenant>>;

  test.beforeAll(async () => {
    tenant = await registerTestTenant();
  });

  test('should navigate to dashboard page', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('should navigate to users page', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/users');
    await page.waitForURL('**/users', { timeout: 15_000 });
    expect(page.url()).toContain('/users');
  });

  test('should navigate to branches page', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/branches');
    await page.waitForURL('**/branches', { timeout: 15_000 });
    expect(page.url()).toContain('/branches');
  });

  test('should navigate to settings page', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/settings');
    await page.waitForURL('**/settings', { timeout: 15_000 });
    expect(page.url()).toContain('/settings');
  });

  test('should redirect away from admin pages (not super admin)', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/admin');

    // Tenant admin should be redirected away from /admin
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 15_000 });
    expect(page.url()).not.toContain('/admin');
  });

  test('should navigate via sidebar links', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({
      timeout: 15_000,
    });

    // Click Branches link in sidebar
    await page.getByRole('link', { name: /branches/i }).click();
    await page.waitForURL('**/branches', { timeout: 10_000 });

    // Click Users link in sidebar
    await page.getByRole('link', { name: /users/i }).click();
    await page.waitForURL('**/users', { timeout: 10_000 });

    // Click Settings link in sidebar
    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('**/settings', { timeout: 10_000 });

    // Click Dashboard link to go back
    await page.getByRole('link', { name: /dashboard/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  });
});
