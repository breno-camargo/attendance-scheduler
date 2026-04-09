import { ApiUtils, parsePagination, requireAuth } from '@/lib/api-utils';
import { ensureHolidaysForYear } from '@/lib/holidays';
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
    const url = new URL(request.url);
    const yearParam = url.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : null;

    if (year && !isNaN(year)) {
      // Se pediu um ano específico, garante que os feriados existam e filtra
      await ensureHolidaysForYear(year);
      const holidays = await prisma.holiday.findMany({
        where: {
          date: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1)),
          },
        },
        select: { id: true, date: true, name: true, fixed: true },
        orderBy: { date: 'asc' },
      });
      return ApiUtils.success(holidays);
    }

    // Sem ano: retorna todos (compatibilidade)
    const currentYear = new Date().getFullYear();
    await ensureHolidaysForYear(currentYear);

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
