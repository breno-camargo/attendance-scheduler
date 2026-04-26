import type { Worksheet } from 'exceljs';

import { ApiUtils, rateLimitKeyFromSession, requireAuthWithScope } from '@/lib/api-utils';
import { audit } from '@/lib/audit';
import { parseSystemTypes } from '@/lib/formatting';
import prisma from '@/lib/prisma';
import { checkImportRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
const MAX_IMPORT_ROWS = 500;

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (Array.isArray(v.richText)) return v.richText.map((rt) => rt.text).join('');
    if ('result' in v) return cellToString(v.result);
    if (typeof v.text === 'string') return v.text;
    return '';
  }
  return String(value);
}

function sheetToJson(sheet: Worksheet): Record<string, string>[] {
  const headers: string[] = [];
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col - 1] = cellToString(cell.value).trim();
  });

  const rows: Record<string, string>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const obj: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      if (!header) return;
      const value = cellToString(row.getCell(idx + 1).value);
      obj[header] = value;
      if (value) hasValue = true;
    });
    if (hasValue) rows.push(obj);
  }
  return rows;
}

const FREQ_MAP: Record<string, string> = {
  mensal: 'MONTHLY',
  bimestral: 'BIMONTHLY',
  trimestral: 'QUARTERLY',
  semestral: 'SEMIANNUAL',
  anual: 'ANNUAL',
};

const DAY_MAP: Record<string, number> = {
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
};

export async function POST(request: Request) {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  if (result.auth.scope === 'filtered') {
    return ApiUtils.error('Apenas o coordenador pode importar planilhas', null, 403);
  }

  const rateKey = rateLimitKeyFromSession(result.session, request);
  const allowed = await checkImportRateLimit(rateKey);
  if (!allowed) {
    return ApiUtils.error(
      'Muitas importações em pouco tempo. Aguarde antes de tentar de novo.',
      null,
      429,
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return ApiUtils.error('Nenhum arquivo enviado', null, 400);
    }

    // Validação de tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return ApiUtils.error('Arquivo muito grande. Máximo permitido: 5MB', null, 400);
    }

    // Validação de tipo (só aceita .xlsx)
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (file.type && !validTypes.includes(file.type)) {
      return ApiUtils.error('Formato inválido. Envie um arquivo .xlsx', null, 400);
    }
    const ext = file.name?.split('.').pop()?.toLowerCase();
    if (ext && !['xlsx', 'xls'].includes(ext)) {
      return ApiUtils.error('Formato inválido. Envie um arquivo .xlsx', null, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    // exceljs 4.4 espera Buffer legado; @types/node retorna Buffer<ArrayBuffer> parametrizado.
    // Compatível em runtime.
    // @ts-expect-error exceljs types lag behind @types/node Buffer generic
    await workbook.xlsx.load(Buffer.from(arrayBuffer));
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return ApiUtils.error('Planilha vazia', null, 400);
    }
    const rows = sheetToJson(sheet);

    if (rows.length === 0) {
      return ApiUtils.error('Planilha vazia', null, 400);
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return ApiUtils.error(
        `Planilha muito grande. Máximo permitido: ${MAX_IMPORT_ROWS} linhas`,
        null,
        400,
      );
    }

    // Cache de profissionais, clientes e supervisores
    const [existingProfs, existingClients, internalStaff] = await Promise.all([
      prisma.professional.findMany(),
      prisma.client.findMany({ include: { contracts: true } }),
      prisma.internalContact.findMany(),
    ]);

    const profCache = new Map(existingProfs.map((p) => [p.name.toLowerCase().trim(), p]));
    const clientCache = new Map(existingClients.map((c) => [c.name.toLowerCase().trim(), c]));
    // Mapa de nome → id para supervisores (Líder e Supervisor)
    const supervisorMap = new Map(
      internalStaff
        .filter((s) => {
          const role = (s.role || '').toLowerCase();
          return role.includes('líder') || role.includes('lider') || role.includes('supervisor');
        })
        .map((s) => [s.name.toLowerCase().trim(), s.id]),
    );

    let created = 0;
    let skipped = 0;
    let techsCreated = 0;
    let clientsCreated = 0;
    const errors: string[] = [];
    const emailDomain = process.env.EMAIL_DOMAIN || 'compasss.com.br';

    // ── PASSADA 1: Parsear linhas e identificar o que precisa criar ──
    interface ParsedRow {
      clientName: string;
      clientPhone: string;
      systemTypes: string;
      visitsPerMonth: number;
      frequency: string;
      preferredDays: string | null;
      techKey: string | null;
      techData: {
        name: string;
        email: string;
        phone: string | null;
        supervisorId: string | null;
      } | null;
    }

    const parsedRows: ParsedRow[] = [];
    const newTechs = new Map<
      string,
      { name: string; email: string; phone: string | null; supervisorId: string | null }
    >();
    const newClients = new Map<string, { name: string; phone: string | null }>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;

      const clientName = String(row['Cliente'] ?? '').trim();
      const clientPhone = String(row['Telefone'] ?? '').trim();
      // Normaliza tokens individualmente (trim + upper) e re-junta sem espaços
      // pra que o front consiga bater com DEFAULT_SYSTEMS no .includes()
      const systemTypes = parseSystemTypes(String(row['Sistemas'] ?? '')).join(',');
      const visitsPerMonth = parseInt(String(row['Visitas/Mês'] ?? row['Visitas'] ?? '2')) || 2;
      const freqRaw = String(row['Frequência'] ?? row['Frequencia'] ?? 'mensal')
        .trim()
        .toLowerCase();
      const frequency = FREQ_MAP[freqRaw] || 'MONTHLY';
      const daysRaw = String(row['Dias Preferidos'] ?? row['Dias'] ?? '')
        .trim()
        .toLowerCase();
      const techName = String(row['Técnico'] ?? row['Tecnico'] ?? '').trim();
      const techPhone = String(row['Telefone Técnico'] ?? row['Tel Técnico'] ?? '').trim();
      const techEmail = String(row['Email Técnico'] ?? row['E-mail Técnico'] ?? '').trim();
      const techScope = String(row['Escopo'] ?? '').trim();

      if (!clientName) {
        errors.push(`Linha ${lineNum}: nome do cliente vazio`);
        continue;
      }

      const preferredDays = daysRaw
        ? daysRaw
            .split(/[,;]/)
            .map((d) => DAY_MAP[d.trim()])
            .filter((d) => d !== undefined)
            .join(',')
        : null;

      let techKey: string | null = null;
      let techData: ParsedRow['techData'] = null;

      if (techName) {
        techKey = techName.toLowerCase().trim();
        if (!profCache.has(techKey) && !newTechs.has(techKey)) {
          const email = techEmail
            ? techEmail.includes('@')
              ? techEmail
              : `${techEmail}@${emailDomain}`
            : `${techName.toLowerCase().replace(/\s+/g, '.')}@${emailDomain}`;
          const supervisorId = techScope
            ? supervisorMap.get(techScope.toLowerCase()) || null
            : null;
          techData = {
            name: ApiUtils.capitalizeName(techName),
            email,
            phone: techPhone || null,
            supervisorId,
          };
          newTechs.set(techKey, techData);
        }
      }

      const clientKey = clientName.toLowerCase().trim();
      if (!clientCache.has(clientKey) && !newClients.has(clientKey)) {
        newClients.set(clientKey, {
          name: ApiUtils.capitalizeName(clientName),
          phone: clientPhone || null,
        });
      }

      parsedRows.push({
        clientName,
        clientPhone,
        systemTypes,
        visitsPerMonth,
        frequency,
        preferredDays,
        techKey,
        techData,
      });
    }

    // ── PASSADA 2: Criar técnicos e clientes novos em batch ──
    if (newTechs.size > 0) {
      await prisma.professional.createMany({
        data: Array.from(newTechs.values()),
        skipDuplicates: true,
      });
      techsCreated = newTechs.size;
      // Recarregar cache com IDs gerados
      const freshProfs = await prisma.professional.findMany({
        where: { name: { in: Array.from(newTechs.values()).map((t) => t.name) } },
      });
      freshProfs.forEach((p) => profCache.set(p.name.toLowerCase().trim(), p));
    }

    if (newClients.size > 0) {
      await prisma.client.createMany({
        data: Array.from(newClients.values()),
        skipDuplicates: true,
      });
      clientsCreated = newClients.size;
      const freshClients = await prisma.client.findMany({
        where: { name: { in: Array.from(newClients.values()).map((c) => c.name) } },
        include: { contracts: true },
      });
      freshClients.forEach((c) => clientCache.set(c.name.toLowerCase().trim(), c));
    }

    // ── PASSADA 3: Criar contratos em batch ──
    const contractsToCreate: {
      clientId: string;
      professionalId: string | null;
      systemTypes: string | null;
      visitsPerMonth: number;
      frequency: string;
      preferredDays: string | null;
    }[] = [];

    for (const pr of parsedRows) {
      const professionalId = pr.techKey ? (profCache.get(pr.techKey)?.id ?? null) : null;
      const clientKey = pr.clientName.toLowerCase().trim();
      const client = clientCache.get(clientKey);
      if (!client) continue;

      // Normaliza ambos lados pra que dados legados com espaço ("SDAI, CFTV")
      // batam com a versão normalizada ("SDAI,CFTV") e não criem duplicata
      const hasContract = client.contracts?.some(
        (c) =>
          parseSystemTypes(c.systemTypes).join(',') === pr.systemTypes &&
          c.professionalId === professionalId,
      );
      if (hasContract) {
        skipped++;
        continue;
      }

      contractsToCreate.push({
        clientId: client.id,
        professionalId,
        systemTypes: pr.systemTypes || null,
        visitsPerMonth: pr.visitsPerMonth,
        frequency: pr.frequency,
        preferredDays: pr.preferredDays,
      });
      created++;
    }

    if (contractsToCreate.length > 0) {
      await prisma.contract.createMany({ data: contractsToCreate });
    }

    audit({
      event: 'DATA_IMPORTED',
      details: `${created} criados, ${skipped} pulados, ${rows.length} total`,
    });

    return ApiUtils.success({
      created,
      skipped,
      techsCreated,
      clientsCreated,
      errors,
      total: rows.length,
    });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao processar planilha', error);
  }
}
