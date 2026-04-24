# Roadmap de Melhorias

Lista das mudanças identificadas no checkup técnico de 2026-04-22. Ordem por prioridade real, não por esforço.

Base sólida: TS strict sem `any`, suíte unit/API/E2E em evolução, security headers completos, CSRF, preview seguro de geração e audit log persistente para operações críticas. Nada aqui é urgente no sentido "tá quebrando" — é dívida técnica real que vale planejar.

---

## ✅ Concluído

**24-abr-2026**

- **Preview de geração de agenda** — `/api/schedule/generate/preview` permite revisar impacto antes da operação destrutiva. UI passou a usar modal de confirmação com resumo, contagens, warnings e confirmação única.
- **Geração anual com escopo correto** — `/generate` agora substitui apenas o ano alvo, preservando outros anos. O aviso no preview usa `existingCount` e anos detectados para comunicar impacto real.
- **Warnings de agenda** — Tier A (configuração) e Tier B (resultado do algoritmo) expostos no preview: `NON_MONTHLY_SDAI`, `NO_MONTHLY_VISITS`, `INVALID_TARGET_MONTHS`, `SDAI_FELL_ON_WEEKDAY`, `UNPLACED_VISITS`.
- **Rate limit de geração/preview** — limites separados para operação destrutiva e preview, reduzindo abuso sem prejudicar uso normal.
- **RUNBOOK atualizado para geração** — documenta fluxo preview → confirmação → generate, escopo do delete, warnings e rate limits.
- **Seed E2E determinístico** — `prisma/seed-e2e.ts` + `globalSetup` do Playwright criam fixtures prefixadas `E2E -`, reduzindo skips por banco vazio.
- **E2E do calendário estabilizado** — `calendar.spec.ts` seleciona explicitamente o técnico fixture e cobre preview → confirmar geração com dados controlados.
- **Cache leve no `api-client`** — TTL + invalidação por tag para melhorar back-nav/prefetch sem introduzir React Query/SWR.
- **Transição light/dark otimizada** — overlay leve evita repaints pesados em páginas com `backdrop-filter`, mantendo troca de tema suave.
- **Modais com rodapé fixo** — formulários de clientes, técnicos, staff, contatos e preview seguem padrão header/body scrollável/footer fixo.
- **`ScheduleGenerationLog` persistente** — registra quem gerou agenda, técnico, ano, contagens e warnings. `RUNBOOK` documenta query de consulta.
- **`AuditLog` genérico para destrutivos** — registra `CLIENT_DELETED`, `PROFESSIONAL_DELETED`, `APPOINTMENT_DELETED` e `SCHEDULE_CLEARED`, com `actorLabel` preservado.
- **Audit de edição de visita** — `APPOINTMENT_UPDATED` registra `before/after` para data, tipo e observação de agendamento.

**23-abr-2026 (quarta parte)**

- **CI enforce_admins habilitado** — branch protection do main agora bloqueia push direto (mesmo de admin) sem `lint + typecheck + test` verde. Workflow PR-first. Habilitado via `gh api -X POST repos/.../branches/main/protection/enforce_admins`.
- **CI alinhado com Node 24** — antes rodava Node 20, dessincado de local + Vercel.
- **`RUNBOOK.md` criado** — playbook pra cenarios de emergencia (admin trancado, reset rate limit, restore Supabase, rotacao NEXTAUTH_SECRET, debug build Vercel, fix schema). Linkado no README.
- **2º admin no banco** + DB password rotacionada — single point of failure removido.
- **`vercel.json` ignoreCommand** atualizado pra usar `VERCEL_GIT_PREVIOUS_SHA` (antes comparava só HEAD^ HEAD, perdendo mudanças em pushes multi-commit).

**23-abr-2026 (terceira parte)**

- **TypeScript 5.9 → 6.0** (item 5) — sem breaking change no projeto. Lint/typecheck/build/323 testes passando direto. As mudancas do TS 6 (`--isolatedDeclarations`, deprecations) nao tocam o codigo atual.
- **`middleware.ts` → `proxy.ts`** — silencia warning de deprecação do Next 16. Renomeia arquivo + função (`middleware` → `proxy`), config (matcher) inalterada.
- **ESLint 8.57 → 9.39 + eslint-config-next 15.5 → 16.2** (item 7) — bem mais simples que o ROADMAP previa: o projeto já usava flat config (`eslint.config.mjs`), só precisou trocar `FlatCompat` (quebrava com `eslint-config-next` 16 nativo) por import direto de `eslint-config-next/core-web-vitals`. Removido `@typescript-eslint/parser` e `@typescript-eslint/eslint-plugin` do `package.json` — vem como transitive de eslint-config-next agora (`typescript-eslint` package).
- **`.npmrc` com `legacy-peer-deps=true`** — destrava deploy na Vercel. `next-auth@4` declara `nodemailer@^7` como peerOptional, conflitando com nosso `nodemailer@8`. Solução temporária até item 2 (Auth.js v5) ou override via `package.json` overrides.

**23-abr-2026 (segunda parte)**

- **Next 14 → 16 + React 18 → 19 + Prisma 5 → 6** (item 3 ampliado) — bump de uma sentada. Codemod oficial (`@next/codemod next-async-request-api`) converteu 7 route handlers pro novo padrão `params: Promise<{ id }>`; 1 (`holidays/[id]`) precisou fix manual. Tests ajustados em 3 arquivos (`Promise.resolve({ id })` em vez de objeto sync). `tsconfig.json` auto-modificado pelo build do Next 16 (jsx → react-jsx, target → ES2017, include `.next/dev/types`). Resolveu **4 CVEs high** do Next (DoS via Image Optimizer, RSC deserialization, rewrites smuggling, next/image cache, Server Components DoS).
- **De 7 vulns foi pra 3** — só restam moderates encadeadas no `next-auth`/`uuid`/`exceljs` (acopladas aos itens 2 e 8).
- **eslint-config-next pinado em 15.5.15** — versão 16 exige eslint 9 (flat config). Decoupling proposital pra não misturar com item 7.

**23-abr-2026 (primeira parte)**

- **Next 14.2.3 → 14.2.35** — resolve CVE critical de cache poisoning (GHSA-gp8f-8m3g-qvj9). Patch-level, sem breaking change.
- **Nodemailer 7 → 8** — resolve SMTP command injection (CRLF via EHLO/HELO — GHSA-vvjj-xcjg-gr5g) e injection via `envelope.size` (GHSA-c7w3-x93f-qmm8). API usada (createTransport/sendMail) estável entre major versions, sem mudança no `src/lib/mail.ts`.
- **Vite (transitivo do vitest)** — fix automático pelos 3 advisories de path traversal / fs.deny bypass / arbitrary file read via WebSocket. Dev-only, mas vale limpar.

**22-abr-2026**

- **Remoção do `xlsx` (SheetJS)** — CVEs conhecidas de prototype pollution e ReDoS. Migrado `src/app/api/import/route.ts` pra ExcelJS (unifica com o uso client-side em `src/app/import/page.tsx`).
- **`@types/node` 20 → 24** — alinha com Node 24 LTS usado local e na Vercel.

---

## 🔴 Alta prioridade

### 1. ~~Refactor do algoritmo de geração de schedule~~ — **revisitado em 23-abr-2026**

Análise original pintou o algoritmo como pior do que ele realmente é. Ao reler `src/lib/schedule-algorithm.ts`:

- **Já está decomposto** em 5 funções puras (`checkMonthActivity`, `findBestSlot`, `allocateSdaiDates`, `distributeMonthVisits`, `renumberVisitsChronologically`, `generateYearSchedule`)
- **Complexidade real é `O(meses × contratos × dias × visitas)`**, não O(n³). Pra 100 contratos × 22 dias úteis × 12 visitas/ano = ~317K operações. Não é gargalo.
- **1057 linhas de testes** (`schedule-generate.test.ts` + `schedule.test.ts`) — cobertura está boa.

Converter pra `ScheduleAllocator` class seria astronautismo arquitetural — pioraria testabilidade de funções puras sem ganho de perf.

**Decisão:** **não fazer**. Se aparecer dor real (perf medida ou bug recorrente), abrir issue específica.

---

### 2. Migração NextAuth 4 → Auth.js v5

**Arquivos afetados:** `src/lib/auth.ts`, `src/proxy.ts`, `src/app/api/*/route.ts` (3 locais com `getServerSession`)

**Por quê:**

- NextAuth 4.24 está em modo de manutenção; Auth.js v5 é o sucessor oficial
- API nova é mais limpa: `auth()` em vez de `getServerSession(authOptions)`
- Melhor integração com App Router (middleware, server components)
- Janela confortável: 12 meses antes de virar problema de CVE / breaking no Next

**Esforço:** meio dia. Release dedicado (não misturar com outras mudanças) por causa dos breaking changes em middleware e session callbacks.

**Riscos:**

- Shape de session muda (custom fields precisam de re-declare em `next-auth.d.ts`)
- CSRF token handling pode ter mudado — validar antes de produção
- Sessions ativas dos usuários expiram na troca — comunicar antes

---

## 🟡 Média prioridade

### 4. Vulnerabilities remanescentes do `npm audit`

Após o upgrade Next 16 + nodemailer 8, restam **3 vulns moderate** todas encadeadas a outros itens:

- `next-auth` → `nodemailer`/`uuid`. Fix requer Auth.js v5 (item 2).
- `exceljs` → `uuid`. Fix depende da lib adotar uuid 14 upstream (item 8).

**Ação:** nenhuma independente. Rodar `npm audit` a cada release pra confirmar que a lista não cresceu.

---

### 9. Monitoring + alerting (Sentry + UptimeRobot)

**Por quê:**

- Cron diário (`/api/ping`) existe pra manter Supabase free tier acordado. Se falhar e ninguém perceber, em ~7 dias o Supabase pausa o projeto e o sistema vai pra ar.
- Erros em rotas pouco usadas (reset de senha, import de planilha) só aparecem quando alguém tenta usar — sem Sentry, descoberta tardia.
- Performance degradando (algoritmo ficando lento) sem monitoring só vira problema quando estoura timeout do Vercel.

**Esforço:** ~10min uptime, ~20min Sentry básico (`npx @sentry/wizard@latest -i nextjs` resolve a maior parte), ~1h pra polir (filtros, source maps, perf monitoring).

**Ordem prática:** UptimeRobot primeiro (cobre 70% do valor com 10min). Sentry depois.

---

### 10. Testes unitários por regra do algoritmo de schedule

**Por quê:**

- 1057 linhas de testes integrados validam o resultado final, mas regras individuais (gap mínimo, fallback SDAI sábado→útil, rotação 3 grupos, dias preferenciais com peso) não tem teste isolado.
- Se alguém mudar `findBestSlot` e quebrar o fallback, testes integrados podem passar mas distribuição fica errada — bug invisível por meses.
- Funções já são puras, fácil de testar isoladamente.

**Esforço:** ~1h. Adicionar `tests/unit/schedule-algorithm.test.ts` com casos por regra.

---

### 11. Fixtures isoladas pros testes E2E

**Por quê:**

- E2E hoje quebra se ordem de execução mudar ou seed mudar (per CLAUDE.md). Resultado: equipe ignora E2E.
- Teste que ignoramos = teste que não existe + ainda gasta tempo. Pior que nenhum teste.

**Esforço:** ~meio dia. Cada `describe` cria seus próprios dados em `beforeEach`, deleta em `afterEach`. Mais lento mas determinístico.

---

## 🗂️ Backlog atual

Itens capturados durante os ciclos de preview, auditoria e polimento de UX. Sem prazo rígido; ordem prática está na seção "Sequência recomendada".

### E2E / QA

- Instalar/validar browsers do Playwright no ambiente local/CI.
- Evoluir fixtures E2E para mais specs além do calendário quando começarem a falhar por estado do banco.
- Cobrir caso de warnings no preview — validar que a seção "Alertas" aparece quando a fixture tem configuração problemática.
- Avaliar E2E leve para audit log: executar ação destrutiva/controlada e confirmar que a UI continua estável. A consulta do log em si pode ficar no RUNBOOK.

### Auditoria / rastreabilidade

- **`CLIENT_UPDATED`**: auditar edição de cliente + contrato principal com `before/after` no `metadataJson` (técnico responsável, frequência, visitas/mês, sistemas, meses alvo, dias preferenciais).
- **`PROFESSIONAL_UPDATED`**: auditar edição de técnico (nome, email, telefone, supervisor). Menor risco que cliente, mas fecha rastreabilidade de cadastro.
- **Contatos de contrato**: avaliar audit para alterações em `contactsJson` quando houver dor real ("quem mudou escalonamento/telefone/email?").
- **Tela interna de logs**: criar `/admin/audit` simples com filtros por data, ação, usuário e entidade. Hoje SQL Editor resolve, mas uma UI reduz atrito operacional.
- **Política de retenção**: decidir se `AuditLog`/`ScheduleGenerationLog` ficam indefinidamente ou se haverá retenção/arquivamento futuro.

### Preview / algoritmo

- Avaliar se warnings Tier B precisam de mais detalhes por contrato/mês.
- Verificar se `UNPLACED_VISITS` fica ruidoso em cenários reais — considerar agrupamento por contrato antes de exibir.
- Avaliar detalhes expansíveis pros alertas no modal (só se a quantidade justificar).

### Operação / segurança

- Confirmar limites de rate-limit em produção após alguns dias de uso real — ajustar se bloquearem uso legítimo.
- Documentar procedimento pra liberar rate-limit de geração/preview manualmente (reset do Redis), seguindo padrão do `resetAccountRateLimit`.
- Formalizar checklist de mudanças de banco: confirmar projeto Supabase, rodar queries de duplicata quando houver novas constraints, registrar `db push` aplicado e query de validação pós-deploy.
- Adicionar monitoramento leve: UptimeRobot para disponibilidade e Sentry para erros de frontend/backend.

### UI / componentes compartilhados

- **Unificar modais customizados no `Modal` shell.** `SchedulePreviewModal` e `ContactListModal` replicam o layout header / body / footer inline em vez de usar `<Modal>` com `footer`. Avaliar se o `Modal` precisa de variações (ex.: header rico, layout em grid, `maxWidth` maior) pra absorver esses casos sem perder customização. Não é bloqueio — só previne drift entre os dois caminhos de modal.

---

## 🟢 Baixa prioridade (update quando tiver tempo)

### 8. `exceljs` 4 → 5 (quando sair)

Quando sair, remove o `@ts-expect-error` em `src/app/api/import/route.ts:97`. Versão 5 deve alinhar Buffer types com `@types/node` recentes.

---

## 🧭 Sequência recomendada

**Próximas sessões dedicadas (em ordem de payoff):**

1. **UptimeRobot + Sentry** (item 9) — ~30min total. Maior leverage agora: evita downtime/erro silencioso depois que auditoria e preview já estão em produção.
2. **`CLIENT_UPDATED` no AuditLog** — PR pequeno/médio, com `before/after` de cliente + contrato principal. Fecha a pergunta "quem mudou o contrato/técnico/frequência?".
3. **`PROFESSIONAL_UPDATED` no AuditLog** — PR pequeno, fecha rastreabilidade de cadastro de técnico.
4. **Tela simples `/admin/audit`** — só depois que os eventos principais estiverem cobertos; por enquanto o SQL Editor resolve.
5. **Testes unitários por regra do algoritmo** (item 10) — ~1h. Protege a parte mais crítica do produto contra regressão silenciosa.
6. **NextAuth → Auth.js v5** (item 2) — esperar GA/estabilidade. Quando fizer, release isolado.

Item 8 (`exceljs` 5) depende de upstream — sem prazo.

## 📝 Política daqui em diante

- Dependências críticas (Next, React, Prisma, NextAuth, Zod): revisar a cada minor release, atualizar no trimestre
- Types e ferramentas dev: atualizar junto com o major da runtime correspondente
- `npm audit` na CI (idealmente `npm audit --audit-level=high --production`) pra pegar regressões
