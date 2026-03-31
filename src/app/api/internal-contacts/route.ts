import { ApiUtils, parsePagination, requireAuth } from '@/lib/api-utils';
import { UNIQUE_ROLES } from '@/lib/constants';
import prisma from '@/lib/prisma';
import { internalContactSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/internal-contacts?page=1&limit=200
 */
export async function GET(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { skip, take } = parsePagination(request.url);
    const contacts = await prisma.internalContact.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    return ApiUtils.success(contacts);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao buscar equipe interna', error);
  }
}

export async function POST(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();

    const validation = internalContactSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;

    // Validação de cargo único (Exclusividade CompaSSS)
    if (data.role && UNIQUE_ROLES.includes(data.role)) {
      const existing = await prisma.internalContact.findFirst({
        where: { role: data.role },
      });
      if (existing) {
        return ApiUtils.error(
          `O cargo de '${data.role}' já está ocupado por ${existing.name}.`,
          null,
          400,
        );
      }
    }

    const contact = await prisma.internalContact.create({
      data: {
        name: ApiUtils.capitalizeName(data.name),
        role: data.role || null,
        phone: data.phone || null,
        email: data.email || null,
      },
    });
    return ApiUtils.success(contact, 201);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao cadastrar equipe', error);
  }
}
