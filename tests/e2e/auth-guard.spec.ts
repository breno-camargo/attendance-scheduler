import { test, expect } from '@playwright/test';

// Override to NOT use saved auth state
test.use({ storageState: { cookies: [], origins: [] } });

const protectedPages = ['/', '/clients', '/professionals', '/staff', '/calendar', '/holidays'];

for (const path of protectedPages) {
  test(`redirects to /login when unauthenticated: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
}
