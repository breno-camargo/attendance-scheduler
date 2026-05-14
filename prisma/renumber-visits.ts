/* eslint-disable no-console */
// One-shot: corrige observations stale em todos os contratos.
//   1. TESTE_SDAI com obs "Visita NN" stale → "Teste Geral SDAI (Trimestral)"
//      (acontece quando usuário trocou o tipo no PATCH antes do fix do PATCH
//      escrever a observation correta).
//   2. VISITA_TECNICA renumeradas em ordem cronológica POR CONTRATO E POR ANO —
//      o PDF filtra por ano, então numeração precisa ser year-scoped.
//
// Uso: npx tsx prisma/renumber-visits.ts
import { PrismaClient } from '@prisma/client';

const SDAI_DEFAULT_OBS = 'Teste Geral SDAI (Trimestral)';
const prisma = new PrismaClient();

async function main() {
  // Passo 1: corrige TESTE_SDAI com observation stale.
  const sdaiStale = await prisma.appointment.findMany({
    where: { type: 'TESTE_SDAI', observation: { not: SDAI_DEFAULT_OBS } },
    select: { id: true, observation: true },
  });
  if (sdaiStale.length > 0) {
    await prisma.$transaction(
      sdaiStale.map((a) =>
        prisma.appointment.update({
          where: { id: a.id },
          data: { observation: SDAI_DEFAULT_OBS },
        }),
      ),
    );
    console.log(`Corrigiu observation de ${sdaiStale.length} TESTE_SDAI stale.`);
  }

  // Agrupa todas as VISITA_TECNICA por (contractId, year)
  const all = await prisma.appointment.findMany({
    where: { type: 'VISITA_TECNICA', contractId: { not: null } },
    orderBy: { date: 'asc' },
    select: { id: true, contractId: true, date: true, observation: true },
  });

  const buckets = new Map<string, { id: string; observation: string | null }[]>();
  for (const v of all) {
    if (!v.contractId) continue;
    const year = v.date.getUTCFullYear();
    const key = `${v.contractId}::${year}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push({ id: v.id, observation: v.observation });
  }

  console.log(`Renumerando ${buckets.size} buckets (contract × year)...`);

  let totalUpdated = 0;
  let bucketsTouched = 0;

  for (const [key, visits] of buckets) {
    const updates = visits
      .map((v, i) => ({
        id: v.id,
        obs: `Visita ${(i + 1).toString().padStart(2, '0')}`,
        old: v.observation,
      }))
      .filter((v) => v.obs !== v.old);

    if (updates.length === 0) continue;

    await prisma.$transaction(
      updates.map((v) =>
        prisma.appointment.update({ where: { id: v.id }, data: { observation: v.obs } }),
      ),
    );

    totalUpdated += updates.length;
    bucketsTouched++;
    console.log(`  ${key}: ${updates.length} visitas renumeradas`);
  }

  console.log(
    `Pronto: ${totalUpdated} visitas renumeradas em ${bucketsTouched}/${buckets.size} buckets.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
