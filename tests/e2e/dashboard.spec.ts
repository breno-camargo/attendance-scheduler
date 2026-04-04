import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders "Sistema Gestor de Manutenção" title', async ({ page }) => {
    await expect(page.locator('h1.title')).toContainText('Sistema Gestor de Manutenção');
  });

  test('stats badges are visible: Clientes, Técnicos, Agendas geradas', async ({ page }) => {
    // Badge labels are in uppercase spans with text-transform
    const badges = page.locator('span', { hasText: /^(Clientes|Técnicos|Agendas geradas)$/ });
    await expect(badges).toHaveCount(3, { timeout: 10000 });
  });

  test('Contratos link navigates to /clients', async ({ page }) => {
    await page.click('a:has-text("Contratos")');
    await page.waitForURL('/clients');
    await expect(page).toHaveURL('/clients');
  });

  test('Técnicos link navigates to /professionals', async ({ page }) => {
    await page.click('a:has-text("Técnicos")');
    await page.waitForURL('/professionals');
    await expect(page).toHaveURL('/professionals');
  });

  test('Calendário link navigates to /calendar', async ({ page }) => {
    await page.click('a:has-text("Visualizar Calendário Completo")');
    await page.waitForURL('/calendar');
    await expect(page).toHaveURL('/calendar');
  });
});
