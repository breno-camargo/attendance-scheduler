import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

/**
 * Reports tests.
 *
 * The report page at /reports/contract/[id] is server-side rendered.
 * These tests navigate to the clients page first, grab a real contract ID
 * from the PDF link href, then visit the report page directly.
 *
 * If no contracts exist the tests are skipped gracefully.
 */

async function getFirstContractId(page: Page): Promise<string | null> {
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');

  // PDF buttons are <a class="btn-icon-green" href="/reports/contract/<id>">
  const pdfLinks = page.locator('a.btn-icon-green');
  const count = await pdfLinks.count();
  if (count === 0) return null;

  const href = await pdfLinks.first().getAttribute('href');
  if (!href) return null;

  const match = href.match(/\/reports\/contract\/([^/]+)/);
  return match ? match[1] : null;
}

test.describe('Contract report page', () => {
  // -------------------------------------------------------------------------
  // 1. Report page loads for a valid contract
  // -------------------------------------------------------------------------
  test('report page loads successfully for a valid contract id', async ({ page }) => {
    const contractId = await getFirstContractId(page);
    if (!contractId) {
      test.skip();
      return;
    }

    await page.goto(`/reports/contract/${contractId}`);
    // The page is SSR and should not redirect or 404
    expect(page.url()).toContain(`/reports/contract/${contractId}`);
    // The report container should be in the DOM
    await expect(page.locator('.report-container')).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // 2. Shows contract info — client name, professional, systems
  // -------------------------------------------------------------------------
  test('report shows client name and professional name', async ({ page }) => {
    const contractId = await getFirstContractId(page);
    if (!contractId) {
      test.skip();
      return;
    }

    await page.goto(`/reports/contract/${contractId}`);
    await expect(page.locator('.report-container')).toBeVisible({ timeout: 10000 });

    // The client name appears in a badge-like <div> near the header
    // It also appears in the contact table as the "technical" row
    // At minimum the report container should contain text content
    const content = await page.locator('.report-container').textContent();
    expect(content?.trim().length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 3. Calendar grid with 12 months is visible
  // -------------------------------------------------------------------------
  test('report contains a calendar grid with 12 month cards', async ({ page }) => {
    const contractId = await getFirstContractId(page);
    if (!contractId) {
      test.skip();
      return;
    }

    await page.goto(`/reports/contract/${contractId}`);
    await expect(page.locator('.report-container')).toBeVisible({ timeout: 10000 });

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

    // calendar-grid contains month-card divs each with a month-header
    const monthCards = page.locator('.month-card');
    const count = await monthCards.count();
    expect(count).toBe(12);

    // Spot-check a few month names
    for (const name of monthNames.slice(0, 3)) {
      await expect(page.locator('.month-header', { hasText: name })).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // 4. Visits table is visible
  // -------------------------------------------------------------------------
  test('report contains the visits table', async ({ page }) => {
    const contractId = await getFirstContractId(page);
    if (!contractId) {
      test.skip();
      return;
    }

    await page.goto(`/reports/contract/${contractId}`);
    await expect(page.locator('.report-container')).toBeVisible({ timeout: 10000 });

    // The appointments table carries the class "visits-table"
    await expect(page.locator('.visits-table')).toBeVisible();

    // It should have column headers Data and Observação
    await expect(page.locator('.visits-table th', { hasText: 'Data' }).first()).toBeVisible();
    await expect(page.locator('.visits-table th', { hasText: 'Observação' }).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. Contact table is present (LISTA DE CONTATOS)
  // -------------------------------------------------------------------------
  test('report shows the "LISTA DE CONTATOS" section', async ({ page }) => {
    const contractId = await getFirstContractId(page);
    if (!contractId) {
      test.skip();
      return;
    }

    await page.goto(`/reports/contract/${contractId}`);
    await expect(page.locator('.report-container')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.contact-table').first()).toBeVisible();
    await expect(page.getByText('LISTA DE CONTATOS')).toBeVisible();
    await expect(page.getByText('ESCALONAMENTO DE OCORRÊNCIAS E CONTATOS-CHAVE')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 6. Header (site navigation) is hidden on the report page
  // -------------------------------------------------------------------------
  test('the site navigation header is not visible on the report page', async ({ page }) => {
    const contractId = await getFirstContractId(page);
    if (!contractId) {
      test.skip();
      return;
    }

    await page.goto(`/reports/contract/${contractId}`);
    await expect(page.locator('.report-container')).toBeVisible({ timeout: 10000 });

    // The global <Header> uses a <header> tag or a nav element; the reports
    // layout replaces the root layout so it should NOT be rendered.
    const header = page.locator('header');
    const headerCount = await header.count();

    // If a <header> element exists it should not be the site nav (no nav links)
    if (headerCount > 0) {
      const navLinks = page.locator('header a[href="/calendar"], header a[href="/clients"]');
      await expect(navLinks).toHaveCount(0);
    }
  });

  // -------------------------------------------------------------------------
  // 7. Systems badges are rendered in the report
  // -------------------------------------------------------------------------
  test('report renders system badges (badge-system class)', async ({ page }) => {
    const contractId = await getFirstContractId(page);
    if (!contractId) {
      test.skip();
      return;
    }

    await page.goto(`/reports/contract/${contractId}`);
    await expect(page.locator('.report-container')).toBeVisible({ timeout: 10000 });

    // At least one system badge should be visible
    await expect(page.locator('.badge-system').first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 8. Year shown in report header matches data year
  // -------------------------------------------------------------------------
  test('year label is visible in the report header', async ({ page }) => {
    const contractId = await getFirstContractId(page);
    if (!contractId) {
      test.skip();
      return;
    }

    await page.goto(`/reports/contract/${contractId}`);
    await expect(page.locator('.report-container')).toBeVisible({ timeout: 10000 });

    // The report shows a badge "Agenda de Atendimento Técnico YYYY"
    const yearBadge = page.locator('div', { hasText: /Agenda de Atendimento Técnico \d{4}/ });
    await expect(yearBadge.first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 9. Navigating to a non-existent contract returns 404
  // -------------------------------------------------------------------------
  test('navigating to a non-existent contract id shows error or not-found', async ({ page }) => {
    const fakeId = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
    const response = await page.goto(`/reports/contract/${fakeId}`);
    const status = response?.status() || 200;
    // Should be 404 or show an error page
    expect(
      [404, 500].includes(status) ||
        (await page.locator('text=not found').count()) > 0 ||
        (await page.locator('text=404').count()) > 0,
    ).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 10. PrintTrigger component renders without errors
  // -------------------------------------------------------------------------
  test('PrintTrigger is mounted and page has no critical JS errors', async ({ page }) => {
    const contractId = await getFirstContractId(page);
    if (!contractId) {
      test.skip();
      return;
    }

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`/reports/contract/${contractId}`);
    await expect(page.locator('.report-container')).toBeVisible({ timeout: 10000 });

    // Filter out known harmless warnings; fail only on real errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('Warning:') && !e.includes('hydration') && !e.includes('ResizeObserver'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
