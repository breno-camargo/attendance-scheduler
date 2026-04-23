# Attendance Scheduler (CompaSSS)

Sistema de agendamento de manutenção preventiva para a CompaSSS. Gera calendários anuais de visitas técnicas e testes de sistemas (SDAI, CFTV, SCA, SAP, SAI) em edifícios e shopping centers.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript (strict mode)
- **Frontend:** React 19, CSS puro (glassmorphism), sem Tailwind
- **Auth:** NextAuth.js (credentials provider), sessão de 8h
- **Database:** PostgreSQL (Supabase) + Prisma ORM
- **Validation:** Zod v4
- **Email:** Nodemailer (SMTP/Gmail)
- **Export/Import:** ExcelJS
- **Rate Limiting:** Upstash Redis (prod) / in-memory (dev)
- **Deploy:** Vercel
- **Tests:** Vitest (unit/API) + Playwright (E2E)

## Commands

```bash
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build
npm test                 # Unit + API tests (Vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright E2E
npm run test:all         # Tudo junto
npm run lint             # ESLint
npm run lint:fix         # ESLint autofix
npm run format           # Prettier
npx prisma generate      # Gerar Prisma client
npx prisma db push       # Sync schema → DB
npx tsx prisma/seed-admin.ts  # Seed admin user
```

## Project Structure

```
src/
├── app/                  # Pages + API routes (App Router)
│   ├── api/              # REST endpoints (clients, professionals, schedule, etc.)
│   ├── calendar/         # Visualização de agenda
│   ├── clients/          # Gestão de clientes/contratos
│   ├── professionals/    # Gestão de técnicos
│   ├── staff/            # Contatos internos
│   ├── holidays/         # Feriados/blackout dates
│   └── reports/          # Geração de PDF
├── components/           # React components por feature
├── lib/                  # Utilities (prisma, auth, api-utils, schemas, mail, rate-limit)
├── types/                # TypeScript interfaces (domain models)
├── hooks/                # Custom React hooks
├── styles/               # CSS global
└── middleware.ts         # Auth + CSRF middleware

prisma/
├── schema.prisma         # Database schema
└── seed-*.ts             # Seeds

tests/
├── unit/lib/             # Unit tests
├── api/                  # API integration tests (Prisma mockado)
└── e2e/                  # Playwright E2E
```

## Path Aliases

- `@/*` → `./src/*`

## Architecture Decisions

- **CSS puro** em vez de Tailwind — controle total do glassmorphism design
- **Sem React Query/SWR** — dados carregados de uma vez, filtro local (~50 clientes)
- **contactsJson (JSON field)** em contratos em vez de tabelas normalizadas — dados mudam frequentemente
- **Testes SDAI sempre aos sábados** — exigência regulatória, enforced no algoritmo de geração
- **PII masking** em views de lista — telefone/email de técnicos mascarados
- **CSRF protection** via middleware (origin check em requests mutantes)
- **Audit logging** para eventos de segurança (login, rate limit)

## API Response Format

```json
{ "data": {...}, "error": null, "status": 200, "ok": true }
```

## Key Rules

- Manter security headers em `next.config.mjs` (CSP, HSTS, X-Frame-Options)
- Nunca expor PII sem mascaramento em endpoints de listagem
- Rate limiting obrigatório em endpoints de auth
- Validação Zod em todo input de API — schemas em `src/lib/schemas.ts`
- Prisma client singleton em `src/lib/prisma.ts` — não instanciar novamente
- Algoritmo de geração de schedule em `src/app/api/schedule/generate/route.ts`

## Business Rules

### Frequências e meses ativos

- Frequências: MONTHLY, BIMONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL
- `visitsPerMonth` (1-30) só se aplica quando frequency === MONTHLY
- Contratos não-mensais usam `targetMonths` ou offset determinístico (charCodeAt do ID) para distribuir nos meses certos
- Ao mudar frequência na UI, `targetMonths` é resetado

### Espaçamento de visitas

- Gap mínimo calculado: `Math.floor(workDays.length / (totalVisits + 1)) - 1` (mínimo 1 dia)
- Visitas posicionadas uniformemente no mês via `targetIdx` + `findBestSlot()`
- Se SDAI cai no mesmo mês, conta como 1 visita (reduz `remaining`)

### Testes SDAI

- Obrigatoriamente aos sábados — exigência regulatória
- Trimestrais, mesmo em contratos mensais (frequency MONTHLY + systemTypes inclui SDAI)
- Preferência por sábados próximos ao dia 25 (fechamento de relatório mensal no dia 30)
- Contratos divididos em 3 grupos de rotação (`idx % 3`) para evitar clustering
- Fallback: se nenhum sábado disponível (feriado), usa dia útil
- Contratos não-mensais: SDAI deve ser inserido manualmente (aviso na UI)

### Dias preferenciais

- `preferredDays`: somente dias úteis (seg-sex, 1-5)
- Peso 0 para dia preferido vs 1000 para outros — degrada gracefully se não houver slot

### Blackout dates

- Fins de semana excluídos (exceto sábados para SDAI)
- Feriados fixos nacionais + Aniversário de SP + feriados customizados do banco
- Feriados móveis calculados via Páscoa: Carnaval, Sexta Santa, Corpus Christi
- Agendamento manual também bloqueado em feriados (erro: "Não é possível agendar em um feriado")

### Sistemas

- Padrão: SDAI, CFTV, SAP, SCA, SAI
- Default em novo contrato: SDAI + CFTV
- Sistemas customizados podem ser adicionados; padrão não pode ser deletado
- Apenas SDAI dispara lógica especial de agendamento aos sábados

### Geração de schedule

- Transacional: deleta TODOS os appointments do profissional e recria em batch (tudo ou nada)
- `createMany` em vez de loop — performance crítica (~400 appointments < 1s)
- Geração é por profissional + ano

### Tipos de appointment

- `VISITA_TECNICA` (default, 120min) e `TESTE_SDAI`
- Pode alternar tipo manualmente na UI

## Coding Conventions

- API routes: usar helpers de `src/lib/api-utils.ts` para respostas padronizadas e auth check
- Novos endpoints devem seguir o padrão CRUD existente (GET list, POST create, PUT/PATCH update, DELETE)
- Toda validação de input via Zod — adicionar schemas em `src/lib/schemas.ts`
- Componentes organizados por feature em `src/components/{feature}/`
- CSS: classes em camelCase, manter padrão glassmorphism existente — sem introduzir Tailwind ou CSS-in-JS
- Types do domínio em `src/types/index.ts` — não duplicar interfaces nos componentes
- Imports sempre com alias `@/` — nunca paths relativos com `../../`

## Testing Rules

- Unit/API tests: `tests/unit/` e `tests/api/` — rodam com Vitest
- API tests mockam Prisma com `vitest-mock-extended` — nunca hit no banco real
- E2E tests: `tests/e2e/` — Playwright, Chrome only
- Rodar `npm test` antes de considerar qualquer mudança pronta
- Novos endpoints precisam de teste de API correspondente

## Known Technical Debt

- Algoritmo de geração de schedule (~400 linhas monolíticas) precisa de refactor — cuidado ao modificar
- E2E tests frágeis — dependem de ordem e seed data
- Histórico de commits inconsistente (mix pt-BR/en) — usar inglês daqui em diante

## Environment

Variáveis em `.env` (ver `.env.example`):

- `DATABASE_URL` / `DIRECT_URL` — Supabase PostgreSQL
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — Auth
- `SMTP_*` — Email
- `UPSTASH_REDIS_REST_*` — Rate limiting (opcional)
