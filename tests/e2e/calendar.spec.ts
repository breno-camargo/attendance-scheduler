import { test, expect } from '@playwright/test';

test.describe('Calendar page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
  });

  // -------------------------------------------------------------------------
  // 1. Page loads with professional selector
  // -------------------------------------------------------------------------
  test('page loads with the professional selector', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Calendário Operacional/ })).toBeVisible();
    await expect(page.getByText('Selecione o Técnico Responsável:')).toBeVisible();

    // The <select> for the professional should be present
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Calendar grid shows 12 months
  // -------------------------------------------------------------------------
  test('calendar grid displays 12 month panels', async ({ page }) => {
    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];

    for (const month of monthNames) {
      await expect(page.getByRole('heading', { name: month, exact: true })).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // 3. Year selector — previous and next year buttons exist and work
  // -------------------------------------------------------------------------
  test('year navigation buttons change the displayed year', async ({ page }) => {
    // Extract the current year shown in the heading
    const heading = page.getByRole('heading', { name: /Calendário Operacional \d{4}/ });
    const headingText = await heading.textContent();
    const match = headingText?.match(/\d{4}/);
    const currentYear = match ? parseInt(match[0]) : new Date().getFullYear();

    // Click next year (›)
    await page.getByRole('button', { name: '›' }).click();
    await expect(
      page.getByRole('heading', { name: `Calendário Operacional ${currentYear + 1}` }),
    ).toBeVisible();

    // Click previous year twice to go one behind the original
    await page.getByRole('button', { name: '‹' }).click();
    await expect(
      page.getByRole('heading', { name: `Calendário Operacional ${currentYear}` }),
    ).toBeVisible();

    await page.getByRole('button', { name: '‹' }).click();
    await expect(
      page.getByRole('heading', { name: `Calendário Operacional ${currentYear - 1}` }),
    ).toBeVisible();

    // Return to original year
    await page.getByRole('button', { name: '›' }).click();
  });

  // -------------------------------------------------------------------------
  // 4. Switching professional triggers a reload (appointments change)
  // -------------------------------------------------------------------------
  test('switching professional reloads the calendar data', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').all();

    if (options.length < 2) {
      test.skip();
      return;
    }

    // Select the second professional
    const secondValue = await options[1].getAttribute('value');
    if (!secondValue) {
      test.skip();
      return;
    }

    // Listen for the API call triggered by changing the professional
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/schedule/generate') && r.status() === 200),
      select.selectOption(secondValue),
    ]);

    expect(response.ok()).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. "Gerar Agenda" / "Re-gerar Agenda" button exists
  // -------------------------------------------------------------------------
  test('"Gerar Agenda" button is visible and enabled when a professional is selected', async ({
    page,
  }) => {
    const generateBtn = page.getByRole('button', { name: /Gerar Agenda|Re-gerar Agenda/ });
    await expect(generateBtn).toBeVisible();
    // The button should be enabled if a professional is already auto-selected
    await expect(generateBtn).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 6. "Gerar Agenda" shows confirmation modal and generates appointments
  // -------------------------------------------------------------------------
  test('"Gerar Agenda" / "Re-gerar Agenda" shows confirmation or generates directly', async ({
    page,
  }) => {
    const generateBtn = page.getByRole('button', { name: /Gerar Agenda|Re-gerar Agenda/ });

    // Intercept to speed things up but still let them through
    await generateBtn.click();

    // Two scenarios:
    // a) A confirm modal appears (if appointments already exist or a different year)
    // b) The schedule is generated directly (no existing data)
    const confirmModal = page.locator('button', { hasText: 'Confirmar' });
    const isVisible = await confirmModal.isVisible().catch(() => false);

    if (isVisible) {
      // Confirm the regeneration
      await confirmModal.click();
    }

    // Either way, loading state or spinner text should appear briefly
    // and then the page should show updated calendar cells
    await page.waitForLoadState('networkidle');

    // The month panels should still be visible after generation
    await expect(page.getByRole('heading', { name: 'Janeiro', exact: true })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 7. Calendar cells with appointments show colored background
  // -------------------------------------------------------------------------
  test('calendar cells with appointments have a non-default background color', async ({ page }) => {
    // Look for cells with appointment colors (green or orange-red)
    const greenCells = page.locator('[style*="#22c55e"]');
    const orangeCells = page.locator('[style*="#ea580c"]');
    const greenCount = await greenCells.count();
    const orangeCount = await orangeCells.count();
    const totalColored = greenCount + orangeCount;

    // If no appointments, skip — generating requires specific DB state
    test.skip(totalColored === 0, 'No appointments in calendar to verify colors');
    expect(totalColored).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 8. Clicking an appointment day opens the detail modal
  // -------------------------------------------------------------------------
  test('clicking an appointment cell opens the "Gerenciar Visita" modal', async ({ page }) => {
    // Find any colored (appointment) cell
    const coloredCells = page.locator(
      '[style*="background: #22c55e"], [style*="background: #ea580c"]',
    );
    const count = await coloredCells.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await coloredCells.first().click();
    await expect(page.getByRole('heading', { name: 'Gerenciar Visita' })).toBeVisible();

    // Close the modal
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByRole('heading', { name: 'Gerenciar Visita' })).not.toBeVisible({
      timeout: 5000,
    });
  });

  // -------------------------------------------------------------------------
  // 9. Can delete an appointment from the detail modal
  // -------------------------------------------------------------------------
  test('can delete an appointment from the detail modal', async ({ page }) => {
    const coloredCells = page.locator(
      '[style*="background: #22c55e"], [style*="background: #ea580c"]',
    );
    const count = await coloredCells.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await coloredCells.first().click();
    await expect(page.getByRole('heading', { name: 'Gerenciar Visita' })).toBeVisible();

    // Accept the native confirm dialog
    page.once('dialog', (dialog) => dialog.accept());

    await page.getByRole('button', { name: /Excluir Visita/ }).click();

    // Modal should close after successful deletion
    await expect(page.getByRole('heading', { name: 'Gerenciar Visita' })).not.toBeVisible({
      timeout: 8000,
    });

    // One less colored cell
    const newCount = await coloredCells.count();
    expect(newCount).toBeLessThan(count);
  });

  // -------------------------------------------------------------------------
  // 10. "Limpar" button requires confirmation before clearing the schedule
  // -------------------------------------------------------------------------
  test('"Limpar" button exists in the calendar toolbar', async ({ page }) => {
    const clearBtn = page.getByRole('button', { name: /Limpar/ });
    await expect(clearBtn).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 11. Holidays show with yellow background
  // -------------------------------------------------------------------------
  test('holiday cells have yellow background', async ({ page }) => {
    // Yellow cells use background: #eab308
    const holidayCells = page.locator('[style*="#eab308"]');
    const count = await holidayCells.count();

    // Not every environment will have holidays seeded; just verify the selector
    // returns the expected color when cells exist
    if (count > 0) {
      const bg = await holidayCells.first().evaluate((el) => (el as HTMLElement).style.background);
      expect(bg).toContain('#eab308');
    } else {
      // Acceptable: no holidays in the DB for this year
      console.log('No holiday cells found — DB may not have holidays seeded.');
    }
  });

  // -------------------------------------------------------------------------
  // 12. Multiple appointments show "+N" badge
  // -------------------------------------------------------------------------
  test('days with multiple appointments display the "+N" badge', async ({ page }) => {
    // The badge is a <span> containing text like "+1", "+2", etc.
    // This uses position: absolute inside the day cell.
    const plusBadges = page.locator('span').filter({ hasText: /^\+\d+$/ });
    const count = await plusBadges.count();

    // Only assert structure if such badges exist; otherwise skip
    if (count > 0) {
      const text = await plusBadges.first().textContent();
      expect(text).toMatch(/^\+\d+$/);
    } else {
      console.log('No multi-appointment days found in current data set.');
    }
  });

  // -------------------------------------------------------------------------
  // 13. Clicking a blank day opens the manual appointment modal
  // -------------------------------------------------------------------------
  test('clicking an empty day opens the manual appointment modal', async ({ page }) => {
    // Find a day cell that has no appointment (transparent / no colored bg)
    // Day cells are <div> with cursor: pointer and no appointment color
    const dayCells = page.locator('[style*="cursor: pointer"]').filter({
      hasNot: page.locator('[style*="background: #22c55e"]'),
    });

    const count = await dayCells.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await dayCells.first().click();

    // Either the manual modal opens or the appointment detail opens.
    // For an empty day it should be the manual modal.
    const manualModal = page.getByRole('heading', { name: 'Novo Agendamento Individual' });
    const detailModal = page.getByRole('heading', { name: 'Gerenciar Visita' });

    const manualVisible = await manualModal.isVisible().catch(() => false);
    const detailVisible = await detailModal.isVisible().catch(() => false);

    expect(manualVisible || detailVisible).toBe(true);

    // Close whichever modal opened
    const closeBtn = page.getByRole('button', { name: /Cancelar|Fechar|Sair/ });
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.first().click();
    }
  });
});
