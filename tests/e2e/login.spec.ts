import { test, expect } from '@playwright/test';

// These tests run without saved auth state so we can test the login page freely
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders username and password fields', async ({ page }) => {
    await expect(page.locator('#login-username')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.fill('#login-username', 'admin@compasss.com.br');
    await page.fill('#login-password', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 15000 });
    await expect(page).toHaveURL('/');
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.fill('#login-username', 'wrong@email.com');
    await page.fill('#login-password', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Usuário ou senha incorretos')).toBeVisible();
  });

  test('shows loading state "Entrando..." while submitting', async ({ page }) => {
    await page.fill('#login-username', 'admin@compasss.com.br');
    await page.fill('#login-password', '123456');

    // Intercept the signIn network call to delay it so we can catch the loading state
    await page.route('**/api/auth/callback/credentials**', async (route) => {
      await page.waitForTimeout(200);
      await route.continue();
    });

    await page.click('button[type="submit"]');
    await expect(page.locator('button[type="submit"]')).toHaveText('Entrando...');
  });
});
