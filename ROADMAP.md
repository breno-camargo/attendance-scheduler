# Roadmap de Melhorias

Lista das mudanças identificadas no checkup técnico de 2026-04-22. Ordem por prioridade real, não por esforço.

Base sólida: TS strict sem `any`, 323 testes passando, security headers completos, CSRF + audit log. Nada aqui é urgente no sentido "tá quebrando" — é dívida técnica real que vale planejar.

---

## ✅ Concluído

**23-abr-2026 (terceira parte)**

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

## 🟢 Baixa prioridade (update quando tiver tempo)

### 5. TypeScript 5.9 → 6.0

TS 6 saiu com algumas breaking changes (flag `--isolatedDeclarations` obrigatória em alguns casos, deprecations removidas). Vale só quando subir tudo mais. Não quebra nada crítico.

### 8. `exceljs` 4 → 5 (quando sair)

Quando sair, remove o `@ts-expect-error` em `src/app/api/import/route.ts:97`. Versão 5 deve alinhar Buffer types com `@types/node` recentes.

---

## 🧭 Sequência recomendada

Pra minimizar retrabalho, aplicar nessa ordem:

1. **NextAuth → Auth.js v5** — esperar GA (ainda em beta.31 em 23-abr-26). Quando sair, resolve as 3 moderates restantes e permite remover o `legacy-peer-deps=true` do `.npmrc`.
2. **TS 6** — revisão de manutenção trimestral.

## 📝 Política daqui em diante

- Dependências críticas (Next, React, Prisma, NextAuth, Zod): revisar a cada minor release, atualizar no trimestre
- Types e ferramentas dev: atualizar junto com o major da runtime correspondente
- `npm audit` na CI (idealmente `npm audit --audit-level=high --production`) pra pegar regressões
