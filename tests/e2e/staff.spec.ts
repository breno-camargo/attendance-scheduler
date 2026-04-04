import { test, expect } from '@playwright/test';

test.describe('Staff page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/staff');
  });

  test('page loads with staff list or empty state', async ({ page }) => {
    await expect(page.locator('h1.title')).toContainText('Painel da Equipe');
    // Sections are always rendered
    await expect(page.locator('text=Manutenção de Sistemas')).toBeVisible();
    await expect(page.locator('text=Escalonamento e Gestão')).toBeVisible();
  });

  test('can open the new staff member modal', async ({ page }) => {
    await page.click('button:has-text("+ Novo Integrante")');
    await expect(page.locator('h2:has-text("Novo Integrante")')).toBeVisible();
  });

  test('can create a new staff member and see toast', async ({ page }) => {
    const unique = `staff-${Date.now()}`;

    await page.click('button:has-text("+ Novo Integrante")');
    await expect(page.locator('h2:has-text("Novo Integrante")')).toBeVisible();

    await page.fill('input[placeholder="Nome do integrante"]', `Staff ${unique}`);

    // Role select (use non-unique role to avoid conflicts)
    await page.selectOption('select', 'Comercial Serviços');

    // Email (optional) — fill prefix only
    await page.fill('input[placeholder="usuário"]', `staff${unique}`);

    // Phone (optional)
    await page.fill('input[placeholder="(11) 99999-9999"]', '11966660000');

    await page.click('button:has-text("Cadastrar")');

    // Toast appears
    await expect(page.locator('text=Contato salvo com sucesso')).toBeVisible({ timeout: 8000 });
  });

  test('can delete a staff member after confirmation', async ({ page }) => {
    // Create one first to ensure there is something to delete
    const unique = `delstaff-${Date.now()}`;

    await page.click('button:has-text("+ Novo Integrante")');
    await page.fill('input[placeholder="Nome do integrante"]', `Delstaff ${unique}`);
    await page.selectOption('select', 'Outros');
    await page.click('button:has-text("Cadastrar")');
    await expect(page.locator('text=Contato salvo com sucesso')).toBeVisible({ timeout: 8000 });

    // Verify created (capitalized)
    await expect(page.locator('text=Delstaff').first()).toBeVisible({ timeout: 5000 });

    // Accept the browser confirm dialog
    page.once('dialog', (dialog) => dialog.accept());

    // Click last delete button
    const deleteButtons = page.locator('button.btn-danger:has-text("Excluir")');
    await deleteButtons.last().click();

    // Wait for deletion
    await page.waitForTimeout(2000);
  });
});
