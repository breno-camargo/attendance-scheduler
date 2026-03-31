import { ApiUtils, parsePagination, requireAuth } from '@/lib/api-utils';
import prisma from '@/lib/prisma';
import { professionalSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/professionals?page=1&limit=200
 * Retorna técnicos cadastrados.
 */
export async function GET(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { skip, take } = parsePagination(request.url);
    const professionals = await prisma.professional.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    return ApiUtils.success(professionals);
  } catch (error: unknown) {
    return ApiUtils.error('Falha ao listar técnicos', error);
  }
}

/**
 * POST /api/professionals
 * Cria um novo técnico com validação de dados (Ponto 3 da Auditoria).
 */
export async function POST(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

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
      },
    });

    return ApiUtils.success(prof, 201);
  } catch (error: unknown) {
    return ApiUtils.error('Erro interno ao criar técnico', error);
  }
}
