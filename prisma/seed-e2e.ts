/* eslint-disable no-console */
/**
 * Seed de fixture pra testes E2E. Idempotente: apaga tudo com prefixo `E2E -`
 * antes de recriar — pode rodar várias vezes sem duplicar nem sujar o DB.
 *
 * Uso: `npx tsx prisma/seed-e2e.ts`
 * Playwright roda isso automaticamente via `tests/e2e/global-setup.ts`.
 *
 * Garante:
 * - 2 técnicos nomeados (`E2E - Técnico A`, `E2E - Técnico B`)
 * - 2 clientes (`E2E - Cliente Calendário A`/`B`), cada um com 1 contrato
 *   vinculado ao Técnico A
 * - ~16 appointments no ano corrente pro Técnico A: 1 visita/mês em cada
 *   cliente + 4 testes SDAI aos sábados (pros testes que checam cor de
 *   célula, clique em visita, exclusão, etc.)
 *
 * Os contratos ficam todos com Técnico A pra simplificar — Técnico B serve
 * só pra garantir que o select do calendário tem >1 opção.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const E2E_PREFIX = 'E2E -';
const YEAR = new Date().getFullYear();

async function wipeE2eFixtures() {
  // Client.delete cascata → Contract.delete → Appointment.delete.
  // Precisa vir antes dos Professional.delete senão FK restrict barra.
  await prisma.client.deleteMany({ where: { name: { startsWith: E2E_PREFIX } } });
  await prisma.professional.deleteMany({ where: { name: { startsWith: E2E_PREFIX } } });
}

function fourthSaturdayOf(month: number): Date {
  // month 0-indexed. Retorna o 4º sábado (dayOfWeek === 6) do mês em YEAR.
  const first = new Date(YEAR, month, 1);
  const firstSatOffset = (6 - first.getDay() + 7) % 7;
  return new Date(YEAR, month, 1 + firstSatOffset + 21);
}

async function seedE2eFixtures() {
  const [tecnicoA, tecnicoB] = await Promise.all([
    prisma.professional.create({
      data: {
        name: `${E2E_PREFIX} Técnico A`,
        email: 'e2e-tecnico-a@compasss.com.br',
        phone: '11999990001',
      },
    }),
    prisma.professional.create({
      data: {
        name: `${E2E_PREFIX} Técnico B`,
        email: 'e2e-tecnico-b@compasss.com.br',
        phone: '11999990002',
      },
    }),
  ]);

  const clienteA = await prisma.client.create({
    data: {
      name: `${E2E_PREFIX} Cliente Calendário A`,
      phone: '1133330001',
      contracts: {
        create: [
          {
            professionalId: tecnicoA.id,
            systemTypes: 'SDAI,CFTV,SAP,SCA,SAI',
            visitsPerMonth: 2,
            frequency: 'MONTHLY',
          },
        ],
      },
    },
    include: { contracts: true },
  });

  const clienteB = await prisma.client.create({
    data: {
      name: `${E2E_PREFIX} Cliente Calendário B`,
      phone: '1133330002',
      contracts: {
        create: [
          {
            professionalId: tecnicoA.id,
            systemTypes: 'SDAI,CFTV',
            visitsPerMonth: 1,
            frequency: 'MONTHLY',
          },
        ],
      },
    },
    include: { contracts: true },
  });

  const contractA = clienteA.contracts[0];
  const contractB = clienteB.contracts[0];

  // 12 visitas (uma por mês, dia 15 — sempre cai em dia útil suficientemente
  // longe das bordas do mês pros testes visuais).
  const visitAppointments = Array.from({ length: 12 }, (_, month) => ({
    clientId: clienteA.id,
    professionalId: tecnicoA.id,
    contractId: contractA.id,
    date: new Date(YEAR, month, 15),
    type: 'VISITA_TECNICA',
  }));

  // 1 visita/mês do Cliente B em dia 20.
  const clienteBVisits = Array.from({ length: 12 }, (_, month) => ({
    clientId: clienteB.id,
    professionalId: tecnicoA.id,
    contractId: contractB.id,
    date: new Date(YEAR, month, 20),
    type: 'VISITA_TECNICA',
  }));

  // 4 testes SDAI trimestrais — no 4º sábado dos meses 2, 5, 8, 11 (mar/jun/set/dez).
  const sdaiAppointments = [2, 5, 8, 11].map((month) => ({
    clientId: clienteA.id,
    professionalId: tecnicoA.id,
    contractId: contractA.id,
    date: fourthSaturdayOf(month),
    type: 'TESTE_SDAI',
    observation: 'Teste Geral SDAI (E2E fixture)',
  }));

  await prisma.appointment.createMany({
    data: [...visitAppointments, ...clienteBVisits, ...sdaiAppointments],
  });
}

async function main() {
  await wipeE2eFixtures();
  await seedE2eFixtures();
  console.log(`✔ Fixture E2E pronta (ano ${YEAR}).`);
}

main()
  .catch((e) => {
    console.error('Falha ao seedar fixture E2E:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
