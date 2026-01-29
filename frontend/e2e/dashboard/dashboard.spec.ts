import { test, expect } from '@playwright/test';
import { registerTestTenant, setAuthTokens } from '../helpers/auth';

test.describe('Dashboard', () => {
  let tenant: Awaited<ReturnType<typeof registerTestTenant>>;

  test.beforeAll(async () => {
    tenant = await registerTestTenant();
  });

  test('should display welcome message', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('should display stat cards', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/dashboard');

    await expect(page.getByText('Total Branches')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Active Users')).toBeVisible();
    await expect(page.getByText('Storage Used')).toBeVisible();
    // "Plan" appears as a card title
    await expect(page.locator('text=Plan').first()).toBeVisible();
  });

  test('should display organization info', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/dashboard');

    // Wait for page to fully load
    await expect(page.getByText('Organization')).toBeVisible({ timeout: 15_000 });

    // Use main content area to avoid hidden mobile sidebar elements
    const mainContent = page.getByRole('main');
    await expect(mainContent.getByText(tenant.companyName)).toBeVisible();
    await expect(mainContent.getByText(tenant.subdomain)).toBeVisible();
  });

  test('should display quick action links', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/dashboard');

    await expect(page.getByText('Add Branch')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Invite User')).toBeVisible();
    await expect(page.getByText('Subscription')).toBeVisible();
  });

  test('should display account information', async ({ page }) => {
    await setAuthTokens(page, tenant);
    await page.goto('/dashboard');

    await expect(page.getByText('Account Information')).toBeVisible({ timeout: 15_000 });
    // Email appears in multiple places, use main content area
    const mainContent = page.getByRole('main');
    await expect(mainContent.getByText(tenant.email).first()).toBeVisible();
  });
});
