# Roadmap de Melhorias

Lista das mudanças identificadas no checkup técnico de 2026-04-22. Ordem por prioridade real, não por esforço.

Base sólida: TS strict sem `any`, 323 testes passando, security headers completos, CSRF + audit log. Nada aqui é urgente no sentido "tá quebrando" — é dívida técnica real que vale planejar.

---

## ✅ Concluído

**23-abr-2026**

- **Next 14.2.3 → 14.2.35** — resolve CVE critical de cache poisoning (GHSA-gp8f-8m3g-qvj9). Patch-level, sem breaking change. `eslint-config-next` alinhado junto.
- **Nodemailer 7 → 8** — resolve SMTP command injection (CRLF via EHLO/HELO — GHSA-vvjj-xcjg-gr5g) e injection via `envelope.size` (GHSA-c7w3-x93f-qmm8). API usada (createTransport/sendMail) estável entre major versions, sem mudança no `src/lib/mail.ts`.
- **Vite (transitivo do vitest)** — fix automático pelos 3 advisories de path traversal / fs.deny bypass / arbitrary file read via WebSocket. Dev-only, mas vale limpar.

De 12 vulns foi pra 7. Restantes acoplados a outros itens deste roadmap (Next 16 = item 3 amplifado; Auth.js v5 = item 2; eslint 9 flat config = item 7; exceljs upstream = item 8).

**22-abr-2026**

- **Remoção do `xlsx` (SheetJS)** — CVEs conhecidas de prototype pollution e ReDoS. Migrado `src/app/api/import/route.ts` pra ExcelJS (unifica com o uso client-side em `src/app/import/page.tsx`).
- **`@types/node` 20 → 24** — alinha com Node 24 LTS usado local e na Vercel.

---

## 🔴 Alta prioridade

### 1. Refactor do algoritmo de geração de schedule
**Arquivo:** `src/lib/schedule-algorithm.ts` (~351 linhas)

**Problema real:**
- Complexidade O(n³) no pior caso — 3 passes aninhados sobre contratos × dias × visitas
- Em 100+ contratos pode passar dos 5s; Vercel timeout default de 30s é colchão, não solução
- `allocateSdaiDates`, `findBestSlot` e `distributeMonthVisits` misturam concerns (alocação + validação + fallback)
- Difícil de testar unitariamente cada regra (só há testes de caminho feliz)

**Proposta:**
- Extrair em `ScheduleAllocator` class com estado entre passes (evita recomputar `workDays`, `holidays`, `professionalAppointments`)
- Separar em 3 responsabilidades: `SlotFinder`, `SdaiAllocator`, `VisitDistributor`
- Adicionar testes unitários por regra (gap mínimo, preferência de dias, fallback de sábado pra dia útil)
- Profiling com cenário sintético de 100 contratos × 12 meses antes e depois

**Esforço:** ~3h de trabalho focado. Tocar com cuidado — já tem testes E2E que cobrem o resultado final.

---

### 2. Migração NextAuth 4 → Auth.js v5
**Arquivos afetados:** `src/lib/auth.ts`, `src/middleware.ts`, `src/app/api/*/route.ts` (3 locais com `getServerSession`)

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

### 3. Next 14 → 15 + React 18 → 19
**Por quê juntos:**
- Next 15 suporta React 19 oficialmente
- React 19 traz `useActionState`, Actions nativas, `use()` hook — melhora DX em forms
- Next 15 tem Server Actions estáveis, melhor error handling, Turbopack dev mais rápido
- Fresh cache semantics (explicit opt-in em vez de opt-out) — pega bugs latentes de cache

**Esforço:** uma tarde. Breaking changes conhecidos:
- `params` e `searchParams` viraram `Promise` em Server Components
- `cookies()`, `headers()`, `draftMode()` agora são async
- Codemod oficial do Next resolve a maioria: `npx @next/codemod@canary upgrade latest`

**Dependente:** Prisma 6 compatibility (OK, já estável)

---

### 4. Vulnerabilities remanescentes do `npm audit`
Quick wins aplicados em 23-abr-2026 (ver Concluído). Restam **7 vulns** todas encadeadas a outros itens:

- **4 high** do Next.js (DoS via Image Optimizer remotePatterns, RSC deserialization, rewrites smuggling, next/image disk cache, Server Components DoS) — fix requer Next 16. **Resolve junto com item 3** (quando evoluir pra Next 15 → 16).
- **3 moderate** encadeadas: `next-auth` → `nodemailer`/`uuid`, `exceljs` → `uuid`. Fix do next-auth requer Auth.js v5 (item 2). Fix do exceljs depende da lib adotar uuid 14 upstream (item 8).

**Ação:** nenhuma independente — acompanha itens 2, 3 e 8. Rodar `npm audit` a cada release pra confirmar que a lista não cresceu.

---

## 🟢 Baixa prioridade (update quando tiver tempo)

### 5. TypeScript 5.9 → 6.0
TS 6 saiu com algumas breaking changes (flag `--isolatedDeclarations` obrigatória em alguns casos, deprecations removidas). Vale só quando subir tudo mais. Não quebra nada crítico.

### 6. Prisma 5.22 → 6.x
Perf melhor, queries type-safe mais estritas. Fazer junto com Next 15 pra aproveitar o restart do ciclo de build.

### 7. ESLint 8 → 9 (flat config)
Migração chata: `.eslintrc.*` → `eslint.config.js`. Vale um dia dedicado, não fatiar. Todos os plugins precisam suportar flat config (eslint-config-next pode precisar de update).

### 8. `exceljs` 4 → 5 (quando sair)
Quando sair, remove o `@ts-expect-error` em `src/app/api/import/route.ts:97`. Versão 5 deve alinhar Buffer types com `@types/node` recentes.

---

## 🧭 Sequência recomendada

Pra minimizar retrabalho, aplicar nessa ordem:

1. **Algoritmo de schedule** (independente de tudo) — pode começar quando quiser
2. **Next 15 + React 19 + Prisma 6** — tudo numa tarde, codemod oficial ajuda
3. **NextAuth → Auth.js v5** — release dedicado, depois do Next 15
4. **ESLint 9 flat config** — quando houver tempo ocioso
5. **TS 6 + npm audit cleanup** — revisão de manutenção trimestral

## 📝 Política daqui em diante

- Dependências críticas (Next, React, Prisma, NextAuth, Zod): revisar a cada minor release, atualizar no trimestre
- Types e ferramentas dev: atualizar junto com o major da runtime correspondente
- `npm audit` na CI (idealmente `npm audit --audit-level=high --production`) pra pegar regressões
