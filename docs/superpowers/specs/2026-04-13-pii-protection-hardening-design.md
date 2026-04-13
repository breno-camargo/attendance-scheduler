# PII Protection Hardening

Data: 2026-04-13

## Contexto

O sistema Compasss (attendance-scheduler) tem autenticacao, RBAC, headers de seguranca e validacao de input bem implementados. Porem, dados sensiveis (email, telefone) sao expostos sem mascara na camada da API — o mascaramento so acontece no frontend. Alem disso, faltam controles complementares: lockout por conta, sanitizacao de logs e rate limit em endpoints de leitura.

## Motivacao

Hardening pratico + base para argumentar compliance LGPD. Sem criptografia de campo no banco nesta fase (fase 2 se compliance exigir).

## Escopo

4 partes independentes, implementadas sequencialmente:

---

### Parte 1: Mascaramento de PII na API

**Problema:** `ApiUtils.maskPII()` so e chamado no frontend. A API retorna dados completos.

**Solucao:**

1. Endpoints de listagem aplicam `maskPII` antes de retornar:
   - `GET /api/professionals` — `src/app/api/professionals/route.ts`
   - `GET /api/clients` — `src/app/api/clients/route.ts`
   - `GET /api/internal-contacts` — `src/app/api/internal-contacts/route.ts`

2. Endpoints de detalhe mantem dados completos com controle de acesso:
   - `GET /api/professionals/[id]` — Coordenador ve tudo; Supervisor so ve completo se for seu supervisionado
   - `GET /api/contracts/[id]/contacts` — mesma logica

3. Remover chamadas de `maskPII` no frontend (agora redundantes):
   - `src/components/clients/ClientTable.tsx`
   - `src/app/professionals/page.tsx`

4. Formularios de edicao ja usam endpoint de detalhe — sem mudanca necessaria.

**Arquivos afetados:**
- `src/lib/api-utils.ts` (maskPII ja existe, sem mudanca)
- `src/app/api/professionals/route.ts` (aplicar maskPII no GET)
- `src/app/api/clients/route.ts` (aplicar maskPII no GET)
- `src/app/api/internal-contacts/route.ts` (aplicar maskPII no GET)
- `src/app/api/professionals/[id]/route.ts` (adicionar check de escopo)
- `src/app/api/contracts/[id]/contacts/route.ts` (adicionar check de escopo)
- `src/components/clients/ClientTable.tsx` (remover maskPII client-side)
- `src/app/professionals/page.tsx` (remover maskPII client-side)

---

### Parte 2: Lockout por conta

**Problema:** Rate limit so por IP. Atacante rotacionando IPs tenta senhas indefinidamente na mesma conta.

**Solucao:**

1. Adicionar rate limiter por username em `src/lib/rate-limit.ts`:
   - 5 tentativas falhas por conta em 15 minutos
   - Usa mesma infra (Upstash prod / memory dev)
   - Funcao: `checkAccountRateLimit(username: string): Promise<boolean>`

2. Em `src/lib/auth.ts` (authorize):
   - Chamar `checkAccountRateLimit` antes de verificar senha
   - Login bem-sucedido reseta o contador (nova funcao `resetAccountRateLimit`)

3. Audit event: reusar `LOGIN_RATE_LIMITED` com details indicando que e por conta.

**Arquivos afetados:**
- `src/lib/rate-limit.ts` (nova funcao + limiter)
- `src/lib/auth.ts` (chamar no authorize)

---

### Parte 3: Sanitizar logs de auditoria

**Problema:** `LOGIN_FAILED` loga `user: ${username}` completo — facilita enumeracao.

**Solucao:**

1. Em `src/lib/auth.ts`, trocar:
   ```
   details: `user: ${username}`
   ```
   Por:
   ```
   details: `user: ${username.charAt(0)}***`
   ```

2. Suficiente pra debug sem expor o username.

**Arquivos afetados:**
- `src/lib/auth.ts` (1 linha)

---

### Parte 4: Rate limit em endpoints de leitura

**Problema:** Endpoints GET autenticados que retornam PII nao tem rate limit. Scraping automatizado pode extrair todos os dados.

**Solucao:**

1. Criar rate limiter generico em `src/lib/rate-limit.ts`:
   - `checkApiRateLimit(ip: string): Promise<boolean>`
   - 60 requests/minuto por IP
   - Upstash prod / memory dev

2. Aplicar nos endpoints de listagem:
   - `GET /api/professionals`
   - `GET /api/clients`
   - `GET /api/internal-contacts`

3. Retornar 429 com `{ error: "Muitas requisicoes. Tente novamente em alguns minutos." }`

**Arquivos afetados:**
- `src/lib/rate-limit.ts` (novo limiter)
- `src/app/api/professionals/route.ts` (chamar no GET)
- `src/app/api/clients/route.ts` (chamar no GET)
- `src/app/api/internal-contacts/route.ts` (chamar no GET)

---

## Fora de escopo

- Criptografia de campos no banco (fase 2)
- Rate limit em endpoints de escrita/mutacao (ja protegidos por auth + CSRF)
- Paginacao server-side (volume atual nao justifica)

## Ordem de implementacao

1. Parte 1 (mascaramento API) — maior impacto em protecao de dados
2. Parte 2 (lockout por conta) — complementa rate limit existente
3. Parte 3 (sanitizar logs) — mudanca trivial
4. Parte 4 (rate limit leitura) — camada extra de protecao

## Teste

Cada parte e testada manualmente antes de seguir pra proxima:
- Parte 1: verificar que listagens retornam dados mascarados, detalhe retorna completo pra coordenador
- Parte 2: verificar que 6a tentativa de login falha na mesma conta e bloqueada
- Parte 3: verificar que logs nao mostram username completo
- Parte 4: verificar que 61a request em 1 min retorna 429
