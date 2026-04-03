import { ApiUtils, parsePagination, requireAuth } from '@/lib/api-utils';
import prisma from '@/lib/prisma';
import { holidaySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/holidays?page=1&limit=200
 */
export async function GET(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { skip, take } = parsePagination(request.url);
    const holidays = await prisma.holiday.findMany({
      select: { id: true, date: true, name: true, fixed: true },
      orderBy: { date: 'asc' },
      skip,
      take,
    });
    return ApiUtils.success(holidays);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao buscar feriados', error);
  }
}

export async function POST(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();

    const validation = holidaySchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;
    const holiday = await prisma.holiday.create({
      data: {
        date: new Date(data.date),
        name: data.name,
      },
    });
    return ApiUtils.success(holiday, 201);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao criar feriado', error);
  }
}
