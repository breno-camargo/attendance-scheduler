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

## Decisões técnicas

- **CSS puro em vez de Tailwind** — queria controle total do glassmorphism. Tailwind abstrairia demais os backdrop-filter e as transições que fazem o visual funcionar. Pra um projeto desse tamanho, 850 linhas de CSS é gerenciável.
- **Sem React Query/SWR** — o frontend carrega tudo de uma vez (são ~50 clientes no máximo) e filtra local. Não justifica a dependência extra. Se crescer, migro.
- **contactsJson como texto em vez de tabela** — cada contrato tem uma lista de contatos de manutenção e escalonamento que muda o tempo todo. Normalizar isso seria 3 tabelas a mais pra um dado que só aparece em 2 telas. JSON resolveu.
- **Rate limiting com Redis + fallback** — Redis (Upstash) em produção, memória em dev. Parece overkill pra 1 admin, mas a tela de login é pública e brute force é trivial. O fallback in-memory garante que funciona sem Redis configurado.
- **Sessão de 8h** — turno de trabalho. O operador loga de manhã e não precisa se preocupar até o fim do dia.
- **SDAI no sábado** — exigência da norma. O teste dispara o alarme de verdade, então o prédio precisa estar vazio.

## O que eu faria diferente

- O algoritmo de geração de agenda funciona mas é um bloco de 400 linhas. Deveria ter quebrado em funções menores desde o início.
- Comecei com commit messages em inglês tentando seguir padrão e depois mudei pra português. Ficou inconsistente no histórico.
- Testes E2E são frágeis — dependem de dados seed e quebram se a ordem muda. Precisam de fixtures isoladas.

## O que falta

- [ ] Notificações por email quando a agenda é gerada
- [ ] Dashboard com métricas de visitas realizadas vs programadas
- [ ] Exportar agenda em formato .ics (Google Calendar)

## Licença

Uso privado — CompaSSS.

---

_Breno Camargo — 2026_
