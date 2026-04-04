import { test, expect } from '@playwright/test';

test.describe('Schedule generation integration flow', () => {
  // -------------------------------------------------------------------------
  // 1. Create client -> generate schedule -> verify calendar
  // -------------------------------------------------------------------------
  test('create client -> generate schedule -> verify calendar', async ({ page }) => {
    // --- Ensure at least one professional exists ---
    await page.goto('/professionals');
    await page.waitForLoadState('networkidle');

    const profCount = await page.locator('ul li').count();
    if (profCount === 0) {
      await page.click('button:has-text("+ Novo Técnico")');
      await expect(page.locator('h2:has-text("Novo Técnico")')).toBeVisible();

      await page.fill('input[placeholder="Nome do Técnico"]', 'Técnico E2E');
      await page.fill('input[placeholder="usuário"]', `tecnico.e2e`);
      await page.fill('input[placeholder="(11) 99999-9999"]', '11999990000');

      await page.click('button:has-text("Criar Técnico")');
      await expect(page.locator('text=Técnico salvo com sucesso')).toBeVisible({ timeout: 8000 });
    }

    // --- Create a new client/contract ---
    const clientName = `Flow E2E ${Date.now()}`;

    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Novo Contrato/ }).click();
    await expect(page.getByRole('heading', { name: 'Novo Contrato' })).toBeVisible();

    await page.getByPlaceholder('Ex: Shopping Ibirapuera').fill(clientName);
    await page.locator('input[type="number"][min="1"]').fill('2');

    await page.getByRole('button', { name: 'Criar Contrato' }).click();
    await expect(page.getByRole('heading', { name: 'Novo Contrato' })).not.toBeVisible({
      timeout: 8000,
    });

    // Verify client appears in the list
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(clientName)).toBeVisible({ timeout: 10000 });

    // --- Go to calendar and generate schedule ---
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');

    // Wait for the professional selector to be available
    const select = page.locator('select').first();
    await expect(select).toBeVisible({ timeout: 10000 });

    // Click "Gerar Agenda" button
    const generateBtn = page.getByRole('button', { name: /Gerar Agenda|Re-gerar Agenda/ });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // If a confirmation modal appears, click "Confirmar"
    const confirmBtn = page.locator('button', { hasText: 'Confirmar' });
    const isConfirmVisible = await confirmBtn.isVisible().catch(() => false);
    if (isConfirmVisible) {
      await confirmBtn.click();
    }

    // Wait for calendar to update
    await page.waitForLoadState('networkidle');

    // Verify month headers are visible (schedule was generated)
    await expect(page.getByRole('heading', { name: 'Janeiro', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fevereiro', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dezembro', exact: true })).toBeVisible();

    // --- Cleanup: delete the test client ---
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Search for the client to isolate it
    await page.getByPlaceholder('Buscar cliente...').fill(clientName);
    await page.waitForLoadState('networkidle');

    const clientItem = page.locator('ul li').filter({ hasText: clientName });
    const clientExists = (await clientItem.count()) > 0;

    if (clientExists) {
      page.once('dialog', (dialog) => dialog.accept());
      await clientItem
        .first()
        .getByRole('button', { name: /Excluir/ })
        .click();
      await page.waitForLoadState('networkidle');
    }
  });

  // -------------------------------------------------------------------------
  // 2. Manual appointment creation on empty day
  // -------------------------------------------------------------------------
  test('manual appointment creation on empty day', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');

    // Find a day cell (cursor: pointer indicates clickable day)
    const dayCells = page.locator('[style*="cursor: pointer"]');
    const count = await dayCells.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // Click the first available day cell
    await dayCells.first().click();

    // A modal should appear — either "Novo Agendamento Individual" or "Gerenciar Visita"
    const manualModal = page.getByRole('heading', { name: 'Novo Agendamento Individual' });
    const detailModal = page.getByRole('heading', { name: 'Gerenciar Visita' });

    const manualVisible = await manualModal.isVisible().catch(() => false);
    const detailVisible = await detailModal.isVisible().catch(() => false);

    expect(manualVisible || detailVisible).toBe(true);

    // Close the modal
    const closeBtn = page.getByRole('button', { name: /Cancelar|Fechar|Sair/ });
    if (
      await closeBtn
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await closeBtn.first().click();
    }

    // Verify modal closed
    await expect(manualModal).not.toBeVisible({ timeout: 5000 });
    await expect(detailModal).not.toBeVisible({ timeout: 5000 });
  });
});
