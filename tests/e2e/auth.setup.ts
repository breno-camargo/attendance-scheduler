import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#login-username', 'admin@compasss.com.br');
  await page.fill('#login-password', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
  await expect(page.locator('text=Sistema Gestor')).toBeVisible();
  await page.context().storageState({ path: '.auth/state.json' });
});
