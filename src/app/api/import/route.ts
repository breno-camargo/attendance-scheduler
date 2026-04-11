import * as XLSX from 'xlsx';

import { ApiUtils, requireAuth } from '@/lib/api-utils';
import { audit } from '@/lib/audit';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
  const authError = await requireAuth();
  if (authError) return authError;

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

    if (rows.length === 0) {
      return ApiUtils.error('Planilha vazia', null, 400);
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

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2; // +2 pq linha 1 é cabeçalho

      const clientName = String(row['Cliente'] ?? '').trim();
      const clientPhone = String(row['Telefone'] ?? '').trim();
      const systemTypes = String(row['Sistemas'] ?? '').trim().toUpperCase();
      const visitsPerMonth = parseInt(String(row['Visitas/Mês'] ?? row['Visitas'] ?? '2')) || 2;
      const freqRaw = String(row['Frequência'] ?? row['Frequencia'] ?? 'mensal').trim().toLowerCase();
      const frequency = FREQ_MAP[freqRaw] || 'MONTHLY';
      const daysRaw = String(row['Dias Preferidos'] ?? row['Dias'] ?? '').trim().toLowerCase();
      const techName = String(row['Técnico'] ?? row['Tecnico'] ?? '').trim();
      const techPhone = String(row['Telefone Técnico'] ?? row['Tel Técnico'] ?? '').trim();
      const techEmail = String(row['Email Técnico'] ?? row['E-mail Técnico'] ?? '').trim();
      const techScope = String(row['Escopo'] ?? '').trim();

      if (!clientName) {
        errors.push(`Linha ${lineNum}: nome do cliente vazio`);
        continue;
      }

      // Resolve ou cria técnico
      let professionalId: string | null = null;
      if (techName) {
        const techKey = techName.toLowerCase().trim();
        let prof = profCache.get(techKey);
        if (!prof) {
          const emailDomain = process.env.EMAIL_DOMAIN || 'compasss.com.br';
          const email = techEmail
            ? (techEmail.includes('@') ? techEmail : `${techEmail}@${emailDomain}`)
            : `${techName.toLowerCase().replace(/\s+/g, '.')}@${emailDomain}`;
          const supervisorId = techScope ? (supervisorMap.get(techScope.toLowerCase()) || null) : null;
          prof = await prisma.professional.create({
            data: {
              name: ApiUtils.capitalizeName(techName),
              email,
              phone: techPhone || null,
              supervisorId,
            },
          });
          profCache.set(techKey, prof);
          techsCreated++;
        }
        professionalId = prof.id;
      }

      // Resolve ou cria cliente
      const clientKey = clientName.toLowerCase().trim();
      let client = clientCache.get(clientKey);

      if (client) {
        // Cliente já existe — verifica se já tem contrato com mesmo sistema
        const hasContract = client.contracts?.some(
          (c) => c.systemTypes?.toUpperCase() === systemTypes && c.professionalId === professionalId,
        );
        if (hasContract) {
          skipped++;
          continue;
        }
      } else {
        client = await prisma.client.create({
          data: {
            name: ApiUtils.capitalizeName(clientName),
            phone: clientPhone || null,
          },
          include: { contracts: true },
        });
        clientCache.set(clientKey, client);
        clientsCreated++;
      }

      // Parse dias preferidos (aceita , ou ; como separador)
      const preferredDays = daysRaw
        ? daysRaw
            .split(/[,;]/)
            .map((d) => DAY_MAP[d.trim()])
            .filter((d) => d !== undefined)
            .join(',')
        : null;

      // Cria contrato
      await prisma.contract.create({
        data: {
          clientId: client.id,
          professionalId,
          systemTypes: systemTypes || null,
          visitsPerMonth,
          frequency,
          preferredDays,
        },
      });

      created++;
    }

    audit({ event: 'DATA_IMPORTED', details: `${created} criados, ${skipped} pulados, ${rows.length} total` });

    return ApiUtils.success({
      created,
      skipped,
      techsCreated,
      clientsCreated,
      errors,
      total: rows.length,
    });
  } catch (error: unknown) {
    console.error('Import error:', error);
    return ApiUtils.error('Erro ao processar planilha', error);
  }
}
