import { ApiUtils, getClientIp, parsePagination, requireAuthWithScope } from '@/lib/api-utils';
import prisma from '@/lib/prisma';
import { checkApiRateLimit } from '@/lib/rate-limit';
import { professionalSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/professionals?page=1&limit=200
 * Retorna técnicos cadastrados.
 */
export async function GET(request: Request) {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  const allowed = await checkApiRateLimit(getClientIp(request));
  if (!allowed)
    return ApiUtils.error('Muitas requisições. Tente novamente em alguns minutos.', null, 429);

  try {
    const { skip, take } = parsePagination(request.url);
    const professionals = await prisma.professional.findMany({
      where: auth.scope === 'filtered' ? { supervisorId: auth.internalContactId } : undefined,
      include: { supervisor: { select: { id: true, name: true, role: true } } },
      // orderBy via localeCompare abaixo — Postgres default é case-sensitive e não trata acentos
      skip,
      take,
    });
    professionals.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    return ApiUtils.success(ApiUtils.maskPII(professionals));
  } catch (error: unknown) {
    return ApiUtils.error('Falha ao listar técnicos', error);
  }
}

/**
 * POST /api/professionals
 * Cria um novo técnico com validação de dados (Ponto 3 da Auditoria).
 */
export async function POST(request: Request) {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  if (result.auth.scope === 'filtered') {
    return ApiUtils.error('Apenas o coordenador pode cadastrar tÃ©cnicos', null, 403);
  }

  try {
    const body = await request.json();

    // Validação com Zod
    const validation = professionalSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;

    // Lógica de e-mail automático (se enviado apenas o prefixo)
    const emailPrefix = data.email || '';
    const email =
      emailPrefix && !emailPrefix.includes('@')
        ? `${emailPrefix}@${process.env.EMAIL_DOMAIN || 'compasss.com.br'}`
        : emailPrefix;

    if (!email) {
      return ApiUtils.error('E-mail é obrigatório', null, 400);
    }

    const prof = await prisma.professional.create({
      data: {
        name: ApiUtils.capitalizeName(data.name),
        email: email,
        phone: data.phone || null,
        supervisorId: data.supervisorId || null,
      },
    });

    // Vincula contratos sem técnico se enviados
    const contractIds = data.contractIds;
    if (Array.isArray(contractIds) && contractIds.length > 0) {
      await prisma.contract.updateMany({
        where: { id: { in: contractIds }, professionalId: null },
        data: { professionalId: prof.id },
      });
    }

    return ApiUtils.success(prof, 201);
  } catch (error: unknown) {
    return ApiUtils.error('Erro interno ao criar técnico', error);
  }
}
