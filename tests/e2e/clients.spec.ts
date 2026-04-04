import { test, expect } from '@playwright/test';

test.describe('Clients / Contracts page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clients');
    // Wait for the page to finish loading data
    await page.waitForLoadState('networkidle');
  });

  // -------------------------------------------------------------------------
  // 1. Page loads and shows client table
  // -------------------------------------------------------------------------
  test('page loads and shows client table', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Gestão de Contratos' })).toBeVisible();
    await expect(page.getByText('Contratos Vigentes')).toBeVisible();
    await expect(page.getByPlaceholder('Buscar cliente...')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. "Novo Contrato" button opens modal
  // -------------------------------------------------------------------------
  test('"Novo Contrato" button opens the contract form modal', async ({ page }) => {
    await page.getByRole('button', { name: /Novo Contrato/ }).click();
    await expect(page.getByRole('heading', { name: 'Novo Contrato' })).toBeVisible();
    await expect(page.getByPlaceholder('Ex: Shopping Ibirapuera')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Can fill and submit new client form
  // -------------------------------------------------------------------------
  test('can fill and submit new contract form', async ({ page }) => {
    const clientName = `Cliente Teste E2E ${Date.now()}`;

    await page.getByRole('button', { name: /Novo Contrato/ }).click();
    await expect(page.getByRole('heading', { name: 'Novo Contrato' })).toBeVisible();

    // Fill in required fields
    await page.getByPlaceholder('Ex: Shopping Ibirapuera').fill(clientName);

    // Frequency is already MONTHLY by default; set visitsPerMonth
    await page.locator('input[type="number"][min="1"]').fill('3');

    // Submit
    const saveBtn = page.getByRole('button', { name: 'Criar Contrato' });
    await saveBtn.click();

    // Modal should close on success
    await expect(page.getByRole('heading', { name: 'Novo Contrato' })).not.toBeVisible({
      timeout: 8000,
    });
  });

  // -------------------------------------------------------------------------
  // 4. Created client appears in table
  // -------------------------------------------------------------------------
  test('created client appears in the table after saving', async ({ page }) => {
    const clientName = `E2E Visivel ${Date.now()}`;

    await page.getByRole('button', { name: /Novo Contrato/ }).click();
    await page.getByPlaceholder('Ex: Shopping Ibirapuera').fill(clientName);
    await page.getByRole('button', { name: 'Criar Contrato' }).click();

    // Wait for the list to refresh
    await page.waitForLoadState('networkidle');

    // The new client name should appear in the list
    await expect(page.getByText(clientName)).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // 5. Search filter works
  // -------------------------------------------------------------------------
  test('search filter narrows down the client list', async ({ page }) => {
    // First check there are at least some clients
    const listItems = page.locator('ul li');
    const count = await listItems.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // Grab the name of the first client for use as a search term
    const firstName = await listItems.first().locator('strong').first().textContent();
    if (!firstName) {
      test.skip();
      return;
    }

    const partial = firstName.slice(0, 4);
    await page.getByPlaceholder('Buscar cliente...').fill(partial);

    // Items that DON'T match the filter should disappear or at least the total
    // count label should update
    await expect(page.locator('ul li').first()).toBeVisible();

    // A completely random search term should show "Nenhum cliente encontrado"
    await page.getByPlaceholder('Buscar cliente...').fill('zzzZZZnonexistent99999');
    await expect(page.getByText(/Nenhum cliente encontrado/)).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 6. Can edit a client
  // -------------------------------------------------------------------------
  test('can open edit modal for an existing client', async ({ page }) => {
    const listItems = page.locator('ul li');
    const count = await listItems.count();
    if (count === 0) {
      test.skip();
      return;
    }

    // Click the edit button on the first card
    await listItems
      .first()
      .getByRole('button', { name: /Editar/ })
      .click();
    await expect(page.getByRole('heading', { name: 'Editar Contrato' })).toBeVisible();

    // Modify the name
    const nameInput = page.getByPlaceholder('Ex: Shopping Ibirapuera');
    const currentName = await nameInput.inputValue();
    await nameInput.fill(currentName + ' (Editado)');

    // Save
    await page.getByRole('button', { name: 'Salvar Alterações' }).click();
    await expect(page.getByRole('heading', { name: 'Editar Contrato' })).not.toBeVisible({
      timeout: 8000,
    });
  });

  // -------------------------------------------------------------------------
  // 7. Can delete a client (with confirm dialog)
  // -------------------------------------------------------------------------
  test('can delete a client after confirming the dialog', async ({ page }) => {
    const listItems = page.locator('ul li');
    const count = await listItems.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const firstName = await listItems.first().locator('strong').first().textContent();

    // Accept the confirm dialog
    page.once('dialog', (dialog) => dialog.accept());
    await listItems
      .first()
      .getByRole('button', { name: /Excluir/ })
      .click();

    // Wait for the list to refresh
    await page.waitForLoadState('networkidle');

    // The deleted client should no longer be shown (if it was the only one,
    // the empty-state message appears; otherwise it's just gone from the list)
    if (firstName) {
      const remainingItems = page.locator('ul li');
      const newCount = await remainingItems.count();
      expect(newCount).toBeLessThan(count);
    }
  });

  // -------------------------------------------------------------------------
  // 8. Contract count shows correctly in the header of the table
  // -------------------------------------------------------------------------
  test('contract count in table header reflects loaded data', async ({ page }) => {
    // The count label reads "N contrato(s)" when there is no active search
    const countLabel = page.locator('text=/contrato/');
    await expect(countLabel.first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 9. Contacts button opens the contact modal
  // -------------------------------------------------------------------------
  test('"Contatos" button opens the contact list modal', async ({ page }) => {
    const listItems = page.locator('ul li');
    const count = await listItems.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const contactsBtn = listItems.first().getByRole('button', { name: /Contatos/ });

    // The button is disabled when there is no contract; skip if so
    const isDisabled = await contactsBtn.getAttribute('disabled');
    if (isDisabled !== null) {
      test.skip();
      return;
    }

    await contactsBtn.click();
    await expect(page.getByRole('heading', { name: /Lista de Contatos/ })).toBeVisible();

    // Close via the × button
    await page.getByRole('button', { name: 'Fechar modal' }).click();
    await expect(page.getByRole('heading', { name: /Lista de Contatos/ })).not.toBeVisible({
      timeout: 5000,
    });
  });

  // -------------------------------------------------------------------------
  // 10. PDF report link exists for clients that have contracts
  // -------------------------------------------------------------------------
  test('PDF report link is present for clients with contracts', async ({ page }) => {
    const listItems = page.locator('ul li');
    const count = await listItems.count();
    if (count === 0) {
      test.skip();
      return;
    }

    // There should be at least one "PDF" link pointing to /reports/contract/...
    const pdfLinks = page.locator('a.btn-icon-green');
    const linkCount = await pdfLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    const href = await pdfLinks.first().getAttribute('href');
    expect(href).toMatch(/\/reports\/contract\/.+/);
  });

  // -------------------------------------------------------------------------
  // 11. Cancel button closes the modal without saving
  // -------------------------------------------------------------------------
  test('cancel button closes the new contract modal without saving', async ({ page }) => {
    await page.getByRole('button', { name: /Novo Contrato/ }).click();
    await expect(page.getByRole('heading', { name: 'Novo Contrato' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Novo Contrato' })).not.toBeVisible({
      timeout: 5000,
    });
  });
});
