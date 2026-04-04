import { test, expect } from '@playwright/test';

test.describe('Holidays page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/holidays');
  });

  test('page loads with holidays list or empty state', async ({ page }) => {
    await expect(page.locator('h1.title')).toContainText('Feriados');
    await expect(page.locator('text=Adicionar Feriado')).toBeVisible();

    const hasHolidays = await page.locator('ul li').count();
    if (hasHolidays === 0) {
      await expect(page.locator('text=Nenhum feriado cadastrado')).toBeVisible();
    } else {
      await expect(page.locator('ul li').first()).toBeVisible();
    }
  });

  test('can add a new holiday and it appears in the list', async ({ page }) => {
    const holidayName = `Feriado Playwright ${Date.now()}`;

    await page.fill('input[type="date"]', '2026-12-25');
    await page.fill('input[placeholder="Ex: Natal"]', holidayName);
    await page.click('button:has-text("Adicionar")');

    // Toast appears
    await expect(page.locator('text=Feriado adicionado com sucesso')).toBeVisible({
      timeout: 8000,
    });

    // Holiday appears in the list
    await expect(page.locator(`text=${holidayName}`)).toBeVisible({ timeout: 8000 });
  });

  test('new holiday shows in the list after creation', async ({ page }) => {
    const holidayName = `DateCheck ${Date.now()}`;

    await page.fill('input[type="date"]', '2026-07-09');
    await page.fill('input[placeholder="Ex: Natal"]', holidayName);
    await page.click('button:has-text("Adicionar")');

    await expect(page.locator('text=Feriado adicionado com sucesso')).toBeVisible({
      timeout: 8000,
    });
    await expect(page.locator(`text=${holidayName}`)).toBeVisible({ timeout: 8000 });
  });

  test('can delete a holiday after confirmation', async ({ page }) => {
    // Ensure a holiday exists to delete
    const holidayName = `ToDelete ${Date.now()}`;
    await page.fill('input[type="date"]', '2026-11-15');
    await page.fill('input[placeholder="Ex: Natal"]', holidayName);
    await page.click('button:has-text("Adicionar")');
    await expect(page.locator('text=Feriado adicionado com sucesso')).toBeVisible({
      timeout: 8000,
    });

    // Verify it exists
    await expect(page.locator(`text=${holidayName}`)).toBeVisible({ timeout: 5000 });

    // Accept the confirm dialog
    page.once('dialog', (dialog) => dialog.accept());

    // Find the li containing our holiday and click its delete button
    const holidayItem = page.locator('li', { hasText: holidayName });
    await holidayItem.locator('button:has-text("Excluir")').click();

    // Verify it's gone
    await expect(page.locator(`text=${holidayName}`)).toBeHidden({ timeout: 8000 });
  });

  test('submit button exists and is clickable', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Adicionar")');
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toBeEnabled();
  });
});
