import { test, expect } from '@playwright/test';

test.describe('Navigation header', () => {
  test('header is visible on dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header.topbar')).toBeVisible();
  });

  test('all nav links are present', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('header.topbar nav.desktop-nav');
    await expect(nav.locator('a:has-text("Dashboard")')).toBeVisible();
    await expect(nav.locator('a:has-text("Clientes")')).toBeVisible();
    await expect(nav.locator('a:has-text("Técnicos")')).toBeVisible();
    await expect(nav.locator('a:has-text("Equipe")')).toBeVisible();
    await expect(nav.locator('a:has-text("Calendário")')).toBeVisible();
    await expect(nav.locator('a:has-text("Feriados")')).toBeVisible();
  });

  test('active link is highlighted on dashboard', async ({ page }) => {
    await page.goto('/');
    const dashboardLink = page.locator('header.topbar nav.desktop-nav a:has-text("Dashboard")');
    // Active link has primary color and bold weight applied via inline style
    await expect(dashboardLink).toHaveCSS('font-weight', '700');
  });

  test('active link is highlighted on clients page', async ({ page }) => {
    await page.goto('/clients');
    const clientesLink = page.locator('header.topbar nav.desktop-nav a:has-text("Clientes")');
    await expect(clientesLink).toHaveCSS('font-weight', '700');
  });

  test('active link is highlighted on professionals page', async ({ page }) => {
    await page.goto('/professionals');
    const tecnicosLink = page.locator('header.topbar nav.desktop-nav a:has-text("Técnicos")');
    await expect(tecnicosLink).toHaveCSS('font-weight', '700');
  });

  test('header is hidden on /login page', async ({ page }) => {
    // Navigate as unauthenticated so we stay on /login
    await page.goto('/login');
    await expect(page.locator('header.topbar')).not.toBeVisible();
  });
});
