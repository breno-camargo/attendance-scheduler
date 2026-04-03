const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const holidays = [
  // ── 2026 ──────────────────────────────────────────────
  { date: '2026-01-01', name: 'Confraternização Universal' },
  { date: '2026-01-25', name: 'Aniversário de São Paulo' },
  { date: '2026-02-16', name: 'Carnaval' },
  { date: '2026-02-17', name: 'Carnaval' },
  { date: '2026-04-03', name: 'Paixão de Cristo' },
  { date: '2026-04-21', name: 'Tiradentes' },
  { date: '2026-05-01', name: 'Dia do Trabalho' },
  { date: '2026-06-04', name: 'Corpus Christi' },
  { date: '2026-07-09', name: 'Revolução Constitucionalista de 1932' },
  { date: '2026-09-07', name: 'Independência do Brasil' },
  { date: '2026-10-12', name: 'Nossa Senhora Aparecida' },
  { date: '2026-11-02', name: 'Finados' },
  { date: '2026-11-15', name: 'Proclamação da República' },
  { date: '2026-11-20', name: 'Dia da Consciência Negra' },
  { date: '2026-12-25', name: 'Natal' },
];

async function main() {
  console.log('Seeding fixed holidays...');

  // 1. Busca todos os feriados existentes de uma vez
  const existing = await prisma.holiday.findMany();
  const existingMap = new Map(
    existing.map(h => [`${h.date.toISOString().split('T')[0]}|${h.name}`, h])
  );

  // 2. Prepara as operações em batch
  const ops = [];
  let created = 0, updated = 0, skipped = 0;

  for (const h of holidays) {
    const key = `${h.date}|${h.name}`;
    const found = existingMap.get(key);

    if (found) {
      if (!found.fixed) {
        ops.push(prisma.holiday.update({
          where: { id: found.id },
          data: { fixed: true },
        }));
        updated++;
        console.log(`  ↻ ${h.name} (${h.date}) → fixed`);
      } else {
        skipped++;
      }
    } else {
      ops.push(prisma.holiday.create({
        data: { date: new Date(h.date), name: h.name, fixed: true },
      }));
      created++;
      console.log(`  + ${h.name} (${h.date})`);
    }
  }

  // 3. Executa tudo em uma transação
  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  console.log(`\nDone: ${created} created, ${updated} updated, ${skipped} already fixed.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
