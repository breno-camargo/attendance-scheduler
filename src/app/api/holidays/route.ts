import { ApiUtils, requireAuth } from '@/lib/api-utils';
import { getHolidaysForYear } from '@/lib/holidays';
import prisma from '@/lib/prisma';
import { holidaySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/holidays?year=2027
 * Retorna feriados fixos (calculados) + customizados (do banco) para o ano.
 * Feriados fixos são gerados on-the-fly, sem salvar no banco.
 */
export async function GET(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    if (isNaN(year) || year < 2020 || year > 2100) {
      return ApiUtils.error('Ano inválido', null, 400);
    }

    // Feriados fixos calculados (não vão pro banco)
    const fixedHolidays = getHolidaysForYear(year).map((h, i) => ({
      id: `fixed-${i}`,
      date: h.date,
      name: h.name,
      fixed: true,
    }));

    // Feriados customizados do banco (adicionados pelo usuário)
    const customHolidays = await prisma.holiday.findMany({
      where: {
        fixed: false,
        date: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
      select: { id: true, date: true, name: true, fixed: true },
      orderBy: { date: 'asc' },
    });

    // Junta e ordena por data
    const all = [...fixedHolidays, ...customHolidays].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return ApiUtils.success(all);
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
