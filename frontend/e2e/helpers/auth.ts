import { Page, request } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:8000/api/v1';

interface TestTenant {
  email: string;
  password: string;
  companyName: string;
  subdomain: string;
  adminName: string;
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  userId: string;
}

/**
 * Register a new test tenant via the API and return credentials + tokens.
 */
export async function registerTestTenant(): Promise<TestTenant> {
  const timestamp = Date.now();
  const subdomain = `test-${timestamp}`;
  const email = `admin-${timestamp}@test.com`;
  const password = 'TestPass123';
  const companyName = `Test Company ${timestamp}`;
  const adminName = `Test Admin ${timestamp}`;

  const url = `${API_BASE}/auth/register`;
  const apiContext = await request.newContext();

  const response = await apiContext.post(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      company_name: companyName,
      subdomain,
      admin_name: adminName,
      admin_email: email,
      admin_password: password,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    await apiContext.dispose();
    throw new Error(`Registration failed (${response.status()}) at ${url}: ${body}`);
  }

  const data = await response.json();
  await apiContext.dispose();

  return {
    email,
    password,
    companyName,
    subdomain,
    adminName,
    accessToken: data.tokens.access_token,
    refreshToken: data.tokens.refresh_token,
    tenantId: data.tenant.id,
    userId: data.user.id,
  };
}

/**
 * Clear all auth state (localStorage, cookies) so middleware doesn't redirect.
 * Call this BEFORE navigating to public pages.
 */
export async function clearAuthState(page: Page) {
  // Clear cookies at the browser context level (works without page load)
  await page.context().clearCookies();

  // Navigate to about:blank to establish a page context, then clear localStorage
  await page.goto('about:blank');
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore errors on about:blank
    }
  });
}

/**
 * Log in via the UI by filling the login form.
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
  options?: { tenantSubdomain?: string }
) {
  await clearAuthState(page);
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  if (options?.tenantSubdomain) {
    await page.locator('#tenant_subdomain').fill(options.tenantSubdomain);
  }
  await page.getByRole('button', { name: 'Login' }).click();
}

/**
 * Set auth tokens directly in localStorage to skip the login UI.
 * Must be called after page.goto() so we have a page context.
 */
export async function setAuthTokens(
  page: Page,
  tenant: TestTenant
) {
  // Clear first, then set up auth
  await clearAuthState(page);
  await page.goto('/login');
  await page.evaluate(
    ({ accessToken, refreshToken, tenantId, userId, email, adminName, companyName, subdomain }) => {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('tenant_id', tenantId);
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: userId,
          email,
          full_name: adminName,
          role: 'admin',
          is_active: true,
        })
      );
      localStorage.setItem(
        'tenant',
        JSON.stringify({
          id: tenantId,
          name: companyName,
          subdomain,
          tier: 'free',
        })
      );
      document.cookie = `user=${encodeURIComponent(
        JSON.stringify({
          id: userId,
          email,
          full_name: adminName,
          role: 'admin',
          is_active: true,
        })
      )}; path=/; max-age=604800`;
    },
    tenant
  );
}
