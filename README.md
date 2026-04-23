# CompaSSS — Agendador de Manutenção

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![Tests](https://img.shields.io/badge/tests-323%20passing-success)
![License](https://img.shields.io/badge/license-private-lightgrey)

Sistema interno da CompaSSS para agendar visitas técnicas e testes de sistemas (SDAI, CFTV, SCA, SAP, SAI) em prédios e shoppings.

## Por que existe

Antes a agenda era feita em planilha. O problema: técnicos esqueciam visitas, testes SDAI atrasavam, e ninguém sabia quem era o contato de escalonamento de cada prédio. Esse sistema resolve isso automatizando a geração de cronogramas anuais e centralizando os contatos.

## Screenshots

|                Dashboard                |                Calendário                 |
| :-------------------------------------: | :---------------------------------------: |
| ![Dashboard](screenshots/dashboard.png) | ![Calendário](screenshots/calendario.png) |

|                Contratos                |                  Relatório PDF                  |
| :-------------------------------------: | :---------------------------------------------: |
| ![Contratos](screenshots/contratos.png) | ![Relatório PDF](screenshots/relatorio.png) |

## Highlights técnicos

- **Algoritmo de geração de agenda** — distribui visitas uniformemente no mês respeitando gap mínimo dinâmico, dias preferenciais por contrato, feriados móveis (Páscoa, Carnaval, Corpus Christi) e fins de semana. Geração transacional: ~400 appointments em < 1s.
- **Testes SDAI obrigatoriamente aos sábados** — exigência da norma, enforced no algoritmo com fallback pra dia útil se o sábado cair em feriado. Rotação em 3 grupos pra evitar clustering.
- **Segurança em camadas** — CSRF via origin check no middleware, rate limiting (Redis Upstash em prod, in-memory em dev), audit log de eventos sensíveis, PII masking (telefone/email) em listagens, security headers completos (CSP, HSTS, X-Frame-Options).
- **TypeScript strict sem escape hatches** — zero `any`, Zod v4 validando todo input de API, schemas centralizados em `src/lib/schemas.ts`.
- **323 testes** — unit (Vitest), API com Prisma mockado (vitest-mock-extended) e E2E (Playwright). Cobertura do algoritmo de schedule + security + rate limiting.

## O que faz

- **Calendário operacional** — gera a agenda do ano inteiro respeitando feriados, fins de semana e a frequência de cada contrato. Testes SDAI trimestrais caem no sábado automaticamente.
- **Gestão de contratos** — cada prédio tem seu contrato com frequência (mensal, bimestral, etc.), sistemas mantidos e técnico responsável.
- **Lista de contatos** — manutenção e escalonamento por contrato, com sincronização automática da equipe interna.
- **Relatório PDF** — cronograma imprimível com calendário, tabela de visitas e contatos. O pessoal do prédio precisa disso em papel.

## Stack

- **Framework** — Next.js 14 (App Router) + TypeScript strict
- **Banco** — PostgreSQL (Supabase) + Prisma ORM
- **Auth** — NextAuth.js (credentials, sessão de 8h)
- **Validação** — Zod v4
- **Email** — Nodemailer (SMTP)
- **Export/Import** — ExcelJS (planilhas), PDF gerado client-side
- **Rate limiting** — Upstash Redis (prod) / in-memory (dev)
- **Testes** — Vitest + Playwright
- **Deploy** — Vercel

## Rodando local

```bash
git clone https://github.com/breno-camargo/attendance-scheduler.git
cd attendance-scheduler
npm install
cp .env.example .env        # preencher variáveis (ver abaixo)
npx prisma generate
npx prisma db push
npm run seed:admin          # cria usuário admin inicial
npm run dev
```

Variáveis obrigatórias em `.env`:

- `DATABASE_URL` / `DIRECT_URL` — Supabase PostgreSQL (pooler + direct)
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — auth
- `EMAIL_DOMAIN` / `NEXT_PUBLIC_EMAIL_DOMAIN` — domínio pra templates de email
- `SMTP_*` — envio de email (reset de senha)

Opcionais:

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — sem isso, rate limit usa memória

## Testes

```bash
npm test                    # unit + API (Vitest)
npm run test:watch          # watch mode
npm run test:coverage       # relatório de cobertura
npm run test:e2e            # E2E (Playwright, Chrome)
npm run test:all            # tudo junto
```

Testes de API mockam o Prisma — nunca hit no banco real. E2E roda contra build de dev com seed fixo.

## Estrutura

```
src/
├── app/           # páginas e API routes (App Router)
├── components/    # componentes por feature (calendar, clients, reports, ui)
├── lib/           # prisma, auth, schemas, api-utils, mail, rate-limit
├── hooks/         # custom React hooks
├── types/         # interfaces do domínio
└── middleware.ts  # auth + CSRF

prisma/            # schema + seeds
tests/             # unit, api, e2e
```

## Decisões técnicas

- **CSS puro em vez de Tailwind** — queria controle total do glassmorphism. Tailwind abstrairia demais os backdrop-filter e as transições que fazem o visual funcionar. Pra um projeto desse tamanho, 850 linhas de CSS é gerenciável.
- **Sem React Query/SWR** — o frontend carrega tudo de uma vez (são ~50 clientes no máximo) e filtra local. Não justifica a dependência extra. Se crescer, migro.
- **contactsJson como texto em vez de tabela** — cada contrato tem uma lista de contatos de manutenção e escalonamento que muda o tempo todo. Normalizar isso seria 3 tabelas a mais pra um dado que só aparece em 2 telas. JSON resolveu.
- **Rate limiting com Redis + fallback** — Redis (Upstash) em produção, memória em dev. Parece overkill pra 1 admin, mas a tela de login é pública e brute force é trivial. O fallback in-memory garante que funciona sem Redis configurado.
- **Sessão de 8h** — turno de trabalho. O operador loga de manhã e não precisa se preocupar até o fim do dia.
- **SDAI no sábado** — exigência da norma. O teste dispara o alarme de verdade, então o prédio precisa estar vazio.

## O que eu faria diferente

- O algoritmo de geração de agenda funciona mas é um bloco de ~350 linhas. Deveria ter quebrado em funções menores desde o início — está no topo do roadmap de refactor.
- Comecei com commit messages em inglês tentando seguir padrão e depois mudei pra português. Ficou inconsistente no histórico.
- Testes E2E são frágeis — dependem de dados seed e quebram se a ordem muda. Precisam de fixtures isoladas.

## Roadmap

Plano de evolução e tech debt documentada em [ROADMAP.md](./ROADMAP.md) — refactor do algoritmo, migração NextAuth → Auth.js v5, Next 15 + React 19, audit cleanup.

## Licença

Uso privado — CompaSSS.

---

_Breno Camargo — 2026_
