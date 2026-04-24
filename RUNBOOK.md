# Runbook — Disaster Recovery

Procedimentos pra cenários "ferrou" — coisas que esperamos nunca usar, mas você vai querer ter quando precisar. Mantém aqui em vez de só na cabeça do dev.

---

## 1. Admin trancado fora (sem login)

**Sintoma:** esqueci a senha, ou a tela de login não aceita, ou SMTP caiu e não consigo receber link de reset.

### a) SMTP funciona — usa o fluxo normal

1. Tela de login → "Recuperar senha"
2. Email chega em até 1min (verifica spam)
3. Link expira em 1h

### b) SMTP fora ou email não chega — reset via SQL direto

1. Acessa Supabase → SQL Editor
2. Gera hash da nova senha localmente:
   ```bash
   npx tsx -e "import bcrypt from 'bcryptjs'; bcrypt.hash('NOVA_SENHA_AQUI', 12).then(h => console.log(h))"
   ```
3. Atualiza no banco:
   ```sql
   UPDATE "User"
   SET password = 'HASH_DO_PASSO_2', "mustChangePassword" = false
   WHERE username = 'SEU_USERNAME';
   ```
4. Loga normalmente.

### c) Não tem nenhum admin no banco — cria do zero

1. Define vars temporárias e roda o seed:
   ```bash
   ADMIN_USERNAME=admin ADMIN_PASSWORD=trocar123 npm run seed:admin
   ```
2. Loga e troca a senha no `/change-password`.

---

## 2. Rate limit travou meu próprio login

**Sintoma:** após 5 tentativas erradas, conta fica bloqueada por 15min. Não dá pra esperar.

### Reset manual

**Em dev (in-memory):** restart do `npm run dev` zera tudo.

**Em prod (Upstash Redis):** acessar Upstash console → Database → Data Browser → deletar a key:

```
account-ratelimit:SEU_USERNAME
```

Ou via CLI:

```bash
curl -X POST "$UPSTASH_REDIS_REST_URL/del/account-ratelimit:SEU_USERNAME" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```

---

## 3. Restaurar do backup do Supabase

**Quando:** dado deletado por engano, schema corrompido, migration ruim.

Supabase faz backup automático diário (retidos 7 dias no plano free, 30 dias no Pro).

### Restore parcial (uma tabela)

1. Supabase Dashboard → Database → Backups
2. "View backup" → seleciona o snapshot mais próximo do incidente
3. SQL Editor → roda `SELECT` na tabela do snapshot
4. Cola dados na tabela atual (ou usa `INSERT INTO ... ON CONFLICT DO NOTHING`)

### Restore completo (point-in-time, plano Pro)

1. Dashboard → Backups → "Restore"
2. Seleciona timestamp
3. Cria projeto novo com snapshot ou substitui o atual (cuidado — destrutivo)
4. Atualiza `DATABASE_URL` / `DIRECT_URL` no `.env` da Vercel se mudou de instância

---

## 4. Suspeita de leak de NEXTAUTH_SECRET

**Sintoma:** secret commitado por engano, ou alguém com acesso ao painel da Vercel saiu do time.

### Rotação

1. Gera novo secret:
   ```bash
   openssl rand -base64 32
   ```
2. Vercel Dashboard → Settings → Environment Variables → atualiza `NEXTAUTH_SECRET`
3. Redeploy (mudança de env var não dispara build automático na Vercel — precisa "Redeploy" manual)
4. **Todos os usuários ativos ficam deslogados** (JWTs antigos invalidados) — comunica antes

---

## 5. Build da Vercel travando

### Erro `npm install` exited with 1

99% das vezes é peer dep conflict. Verifica `.npmrc` na raiz do repo:

```
legacy-peer-deps=true
```

Se sumir, recommit. Vercel respeita.

### Build skippa quando deveria buildar

Verifica `vercel.json` → `ignoreCommand`. Hoje compara `VERCEL_GIT_PREVIOUS_SHA HEAD` em `src/`, `public/`, `prisma/`, `package.json`, `package-lock.json`, `next.config.mjs`, `vercel.json`, `.npmrc`. Se mudou só doc (CLAUDE.md, README.md), **não builda — by design**. Pra forçar deploy, faz commit em qualquer arquivo monitorado ou trigger manual no dashboard.

### Build falha em runtime após deploy

Vercel Dashboard → Deployments → clica no deploy → "Function Logs" → filtra por timestamp do erro.

---

## 6. Schema do DB precisa de fix manual urgente

**Quando:** Prisma migration ruim, coluna esquecida, índice faltando.

### Diagnóstico

```bash
npx prisma db pull --print  # mostra schema atual no banco
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma  # mostra diferença
```

### Fix sem perder dados

1. Edita `prisma/schema.prisma` com a mudança desejada
2. Roda `npx prisma db push` (NÃO usa `migrate dev` — esse pode resetar)
3. `npx prisma generate` pra atualizar o client

---

## 7. Acesso emergencial ao banco em produção

### Via Supabase SQL Editor (recomendado)

Dashboard → SQL Editor → conecta direto. Histórico salvo, audit trail.

### Via psql (se preferir CLI)

```bash
# Pega DIRECT_URL do .env (sem pgbouncer)
psql "$DIRECT_URL"
```

---

## Fluxo de geração de agenda

Referência operacional do que acontece quando o usuário aperta "Gerar Agenda" no calendário. Útil quando alguém pergunta "por que gerou X e antes era Y?", "o que é esse 429?" ou "por que apareceu esse alerta?".

### Passo a passo

1. Usuário seleciona técnico + ano e clica em **Gerar/Re-gerar**.
2. Frontend chama `POST /api/schedule/generate/preview`.
3. Preview roda o algoritmo em memória (`runScheduleGeneration`) — **nada é gravado**.
4. Modal abre mostrando:
   - Total novo a criar, contratos afetados, visitas vs testes SDAI.
   - Distribuição por mês.
   - Seção **Alertas** se houver warnings.
   - Linha **"Substituição de agenda: X → Y (+Δ)"** quando há agenda existente no ano.
5. Usuário confirma. Frontend chama `POST /api/schedule/generate`.
6. `/generate` apaga e recria a agenda dentro de uma transação (atômico).
7. `audit` registra: `"N contratos, substituiu X, criou Y"`.

### Escopo do delete

O `deleteMany` do `/generate` **só apaga o ano alvo**:

```
WHERE
  (professionalId = X OR contractId IN [contratos do X])
  AND date >= jan-01 do ano
  AND date <  jan-01 do ano+1
```

- **Outros anos do mesmo técnico ficam intactos** (mudança introduzida no PR #6).
- O OR com `contractId` cobre contratos que foram reassociados entre técnicos: se o contrato C estava com o técnico A e agora está com o técnico B, gerar o ano para B apaga também os appointments antigos de A para C naquele ano — preservando invariante "não tem dois técnicos agendando o mesmo contrato".

### Interpretação dos números do modal

| Campo | O que significa |
|---|---|
| `existingCount` | Quantos appointments **já existem** no ano alvo, no mesmo escopo do delete. Se `> 0`, a geração vai substituí-los. |
| `count` | Quantos appointments serão **criados**. |
| Delta `+Δ` | Diferença líquida (`count - existingCount`). Pode ser positivo, negativo ou zero. |
| "Outros anos detectados: 2026, 2028" | O técnico tem agenda nesses anos, mas eles **não serão afetados**. |

### Warnings

Todos vêm no array `warnings` do `/preview`. Não bloqueiam geração.

**Tier A — configuração dos contratos** (detectados antes de rodar o algoritmo):

- `NON_MONTHLY_SDAI`: contrato não-mensal com SDAI nos `systemTypes`. Só MONTHLY dispara agendamento automático de SDAI — em outras frequências, tem que inserir manualmente.
- `NO_MONTHLY_VISITS`: MONTHLY com `visitsPerMonth <= 0`. Contrato vai gerar zero appointments — provavelmente erro de configuração.
- `INVALID_TARGET_MONTHS`: contrato não-mensal com `targetMonths` preenchido sem nenhum número válido em 0..11. **Esse contrato não vai agendar em nenhum mês** — conferir configuração.

**Tier B — execução do algoritmo** (descobertos durante a geração):

- `SDAI_FELL_ON_WEEKDAY`: teste SDAI caiu em dia útil porque todos os sábados do mês estão bloqueados por feriado. Payload inclui `date`.
- `UNPLACED_VISITS`: algoritmo tentou alocar N visitas no mês mas só encaixou M. Payload inclui `month` e `missingCount`. Causas comuns: muito feriado no mês, `visitsPerMonth` alto demais pra quantidade de dias úteis.

### Rate limits

Ambos endpoints têm rate limit por `session.user.id` (fallback pra email, fallback pra IP).

| Endpoint | Prod | Dev | Janela |
|---|---|---|---|
| `/api/schedule/generate` | 10 | 50 | 1 hora |
| `/api/schedule/generate/preview` | 30 | 200 | 1 minuto |

Se bater, response é **429** com mensagem amigável. Basta esperar a janela.

Em prod, limites são armazenados no Upstash Redis (sliding window). Sem Redis configurado, cai num fallback in-memory (aceitável em dev, não em prod com múltiplas instâncias).

---

## 📞 Contatos críticos

- **Dev principal:** Breno Camargo — email: breno.hsc75@gmail.com / tel: (11)99012-7316
- **Admin secundário:** _criar segunda conta admin no banco e guardar credenciais em cofre_
- **Supabase support:** [supabase.com/dashboard](https://supabase.com/dashboard) → Help (resposta em até 48h no plano free)
- **Vercel support:** [vercel.com/help](https://vercel.com/help)

---

## 🛡️ Política de prevenção

- Sempre ter **2 admins ativos** no banco (você + 1 backup de confiança com senha em cofre)
- `NEXTAUTH_SECRET` rotacionado se alguém com acesso à Vercel sair
- Backup do Supabase verificado mensalmente (clicar "View backup" pra confirmar que existe e é restorable)
- `.env.example` sempre atualizado quando adicionar nova variável

---

_Adicionar novos cenários aqui à medida que aparecerem na prática. Documenta antes de esquecer._
