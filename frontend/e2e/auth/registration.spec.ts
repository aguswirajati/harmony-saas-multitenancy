import { test, expect } from '@playwright/test';

test.describe('Registration', () => {
  test('should register a new tenant and redirect to dashboard', async ({ browser }) => {
    const timestamp = Date.now();
    const subdomain = `e2e-reg-${timestamp}`;
    const email = `reg-${timestamp}@test.com`;

    // Use fresh context
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/register', { waitUntil: 'networkidle' });

    // Wait for any compilation to settle
    await page.waitForTimeout(2000);

    // Verify page loaded - look for the company name field
    await expect(page.locator('#company_name')).toBeVisible({ timeout: 15_000 });

    // Fill registration form
    await page.locator('#company_name').fill(`Reg Test ${timestamp}`);
    await page.locator('#subdomain').fill(subdomain);
    await page.locator('#admin_name').fill('E2E Test Admin');
    await page.locator('#admin_email').fill(email);
    await page.locator('#admin_password').fill('TestPass123');

    // Wait for button to be stable
    const submitButton = page.getByRole('button', { name: 'Create Account' });
    await submitButton.waitFor({ state: 'visible', timeout: 5_000 });
    await submitButton.click();

    // Should redirect to dashboard - increase timeout for slow dev server
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    expect(page.url()).toContain('/dashboard');

    // Verify tokens stored
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(accessToken).toBeTruthy();

    await context.close().catch(() => {});
  });

  test('should show error for duplicate subdomain', async ({ browser }) => {
    const timestamp = Date.now();
    const subdomain = `e2e-dup-${timestamp}`;
    const baseEmail = `dup-${timestamp}`;

    // First context - register first tenant
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/register', { waitUntil: 'networkidle' });
    await page1.waitForTimeout(1000);
    await page1.locator('#company_name').fill(`Dup Test ${timestamp}`);
    await page1.locator('#subdomain').fill(subdomain);
    await page1.locator('#admin_name').fill('First Admin');
    await page1.locator('#admin_email').fill(`${baseEmail}-a@test.com`);
    await page1.locator('#admin_password').fill('TestPass123');
    await page1.getByRole('button', { name: 'Create Account' }).click();
    await page1.waitForURL('**/dashboard', { timeout: 30_000 });
    await context1.close().catch(() => {});

    // Second context - try duplicate subdomain
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await page2.goto('/register', { waitUntil: 'networkidle' });
    await page2.waitForTimeout(1000);
    await page2.locator('#company_name').fill(`Dup Test 2 ${timestamp}`);
    await page2.locator('#subdomain').fill(subdomain);
    await page2.locator('#admin_name').fill('Second Admin');
    await page2.locator('#admin_email').fill(`${baseEmail}-b@test.com`);
    await page2.locator('#admin_password').fill('TestPass123');
    await page2.getByRole('button', { name: 'Create Account' }).click();

    // Should show error - use more specific selector excluding route announcer
    await expect(page2.locator('[role="alert"]:not([id="__next-route-announcer__"])')).toBeVisible({ timeout: 15_000 });

    await context2.close().catch(() => {});
  });

  test('should have link to login page', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/register', { waitUntil: 'networkidle' });
    const loginLink = page.getByRole('link', { name: /login/i });
    await expect(loginLink).toBeVisible({ timeout: 10_000 });
    await loginLink.click();
    await page.waitForURL('**/login');

    await context.close().catch(() => {});
  });
});
