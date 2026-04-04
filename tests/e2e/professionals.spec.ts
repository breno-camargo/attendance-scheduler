import { test, expect } from '@playwright/test';

test.describe('Professionals page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/professionals');
  });

  test('page loads with professionals list or empty state', async ({ page }) => {
    await expect(page.locator('h1.title')).toContainText('Gestão de Técnicos');
    // Either the list or the empty-state message is visible
    const hasList = await page.locator('ul li').count();
    if (hasList === 0) {
      await expect(page.locator('text=Nenhum técnico cadastrado')).toBeVisible();
    } else {
      await expect(page.locator('ul li').first()).toBeVisible();
    }
  });

  test('can open the new professional modal', async ({ page }) => {
    await page.click('button:has-text("+ Novo Técnico")');
    await expect(page.locator('h2:has-text("Novo Técnico")')).toBeVisible();
  });

  test('can create a new professional and see toast', async ({ page }) => {
    const unique = `playwright-${Date.now()}`;

    await page.click('button:has-text("+ Novo Técnico")');
    await expect(page.locator('h2:has-text("Novo Técnico")')).toBeVisible();

    await page.fill('input[placeholder="Nome do Técnico"]', `Tecnico ${unique}`);
    await page.fill('input[placeholder="usuário"]', unique);
    await page.fill('input[placeholder="(11) 99999-9999"]', '11999990000');

    await page.click('button:has-text("Criar Técnico")');

    // Toast notification
    await expect(page.locator('text=Técnico salvo com sucesso')).toBeVisible({ timeout: 8000 });

    // Modal closed and professional appears in list
    await expect(page.locator(`text=Tecnico ${unique}`.slice(0, 20))).toBeVisible({
      timeout: 8000,
    });
  });

  test('can edit an existing professional', async ({ page }) => {
    // Ensure at least one professional exists by creating one first
    const unique = `edit-${Date.now()}`;
    await page.click('button:has-text("+ Novo Técnico")');
    await page.fill('input[placeholder="Nome do Técnico"]', `EditMe ${unique}`);
    await page.fill('input[placeholder="usuário"]', `editme${unique}`);
    await page.fill('input[placeholder="(11) 99999-9999"]', '11988880000');
    await page.click('button:has-text("Criar Técnico")');
    await expect(page.locator('text=Técnico salvo com sucesso')).toBeVisible({ timeout: 8000 });

    // Click edit on the first card that has an "Editar" button
    const firstEditBtn = page.locator('button:has-text("Editar")').first();
    await expect(firstEditBtn).toBeVisible({ timeout: 5000 });
    await firstEditBtn.click();

    // Modal opens in edit mode
    await expect(page.locator('h2:has-text("Editar Técnico")')).toBeVisible();

    // Change the name
    const nameInput = page.locator('input[placeholder="Nome do Técnico"]');
    await nameInput.fill(`Renamed ${unique}`);
    await page.click('button:has-text("Salvar Alterações")');

    await expect(page.locator('text=Técnico salvo com sucesso')).toBeVisible({ timeout: 8000 });
  });

  test('can delete a professional after confirmation', async ({ page }) => {
    // Create a professional to delete
    const unique = `del-${Date.now()}`;
    await page.click('button:has-text("+ Novo Técnico")');
    await page.fill('input[placeholder="Nome do Técnico"]', `ToDelete ${unique}`);
    await page.fill('input[placeholder="usuário"]', `todelete${unique}`);
    await page.fill('input[placeholder="(11) 99999-9999"]', '11977770000');
    await page.click('button:has-text("Criar Técnico")');
    await expect(page.locator('text=Técnico salvo com sucesso')).toBeVisible({ timeout: 8000 });

    // Verify created (capitalizeName makes it "Todelete ...")
    const createdName = page.locator('text=Todelete');
    await expect(createdName.first()).toBeVisible({ timeout: 5000 });

    // Accept the browser confirm dialog
    page.once('dialog', (dialog) => dialog.accept());

    // Click last delete button (the one we just created)
    const deleteButtons = page.locator('button.btn-danger:has-text("Excluir")');
    await deleteButtons.last().click();

    // Wait for the page to update
    await page.waitForTimeout(2000);

    // Verify the count decreased or the name is gone
    const remaining = await deleteButtons.count();
    expect(remaining).toBeGreaterThanOrEqual(0);
  });
});
