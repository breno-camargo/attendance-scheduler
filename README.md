# CompaSSS — Agendador de Manutenção

Sistema interno da CompaSSS para agendar visitas técnicas e testes de sistemas (SDAI, CFTV, SCA, SAP, SAI) em prédios e shoppings.

## Por que existe

Antes a agenda era feita em planilha. O problema: técnicos esqueciam visitas, testes SDAI atrasavam, e ninguém sabia quem era o contato de escalonamento de cada prédio. Esse sistema resolve isso automatizando a geração de cronogramas anuais e centralizando os contatos.

## O que faz

- **Calendário operacional** — gera a agenda do ano inteiro respeitando feriados, fins de semana e a frequência de cada contrato. Testes SDAI trimestrais caem no sábado automaticamente.
- **Gestão de contratos** — cada prédio tem seu contrato com frequência (mensal, bimestral, etc.), sistemas mantidos e técnico responsável.
- **Lista de contatos** — manutenção e escalonamento por contrato, com sincronização automática da equipe interna.
- **Relatório PDF** — cronograma imprimível com calendário, tabela de visitas e contatos. O pessoal do prédio precisa disso em papel.

## Stack

- Next.js 14 (App Router) + TypeScript
- PostgreSQL (Supabase) + Prisma
- NextAuth.js (auth simples com credenciais por enquanto)
- Zod (validação)
- CSS puro (glassmorphism, dark/light theme)
- Deploy na Vercel

## Rodando local

```bash
git clone https://github.com/breno-camargo/attendance-scheduler.git
cd attendance-scheduler
npm install
cp .env.example .env   # preencher DATABASE_URL e DIRECT_URL
npx prisma generate
npx prisma db push
npm run dev
```

## Estrutura

```
src/
├── app/           # páginas e API routes
├── components/    # componentes por feature (calendar, clients, reports, ui)
├── lib/           # prisma, auth, schemas, utils
└── types/         # interfaces do domínio
```

## O que falta

- [ ] Login com tabela de usuários e bcrypt (hoje é 1 admin hardcoded)
- [ ] Rate limiting persistente (hoje é in-memory, reseta no deploy)
- [ ] Notificações por email quando a agenda é gerada
- [ ] Dashboard com métricas de visitas realizadas vs programadas

## Licença

Uso privado — CompaSSS.

---

_Breno Camargo — 2026_
