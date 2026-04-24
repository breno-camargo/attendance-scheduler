// Wrapper de fetch pro frontend — evita repetir try/catch e JSON.parse em todo lugar.
// Cada recurso da API tem suas funções tipadas embaixo.
//
// Cache leve em memória pra GETs: TTL curto + invalidação por tag nas mutations.
// Objetivo: back-nav entre abas e prefetch de menu ficam instantâneos sem
// introduzir React Query/SWR. Cache é per-aba (window), some no refresh.

import type {
  Appointment,
  Client,
  Contact,
  Holiday,
  InternalContact,
  Professional,
  SchedulePreviewData,
} from '@/types';

interface ApiFetchOptions extends RequestInit {
  raw?: boolean;
}

interface ApiResult<T> {
  data: T | null;
  error: string | null;
  status: number;
  ok: boolean;
}

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<ApiResult<T>> {
  try {
    const { raw, ...fetchOptions } = options;

    if (fetchOptions.body && !fetchOptions.headers) {
      fetchOptions.headers = { 'Content-Type': 'application/json' };
    }

    const res = await fetch(url, fetchOptions);
    const status = res.status;
    const ok = res.ok;

    if (raw) {
      return { data: null, error: null, status, ok };
    }

    const data = await res.json();

    if (!ok) {
      const errorMsg = data?.error || data?.details || `Erro ${status}`;
      return { data: null, error: errorMsg, status, ok: false };
    }

    return { data: data as T, error: null, status, ok: true };
  } catch {
    return { data: null, error: 'Falha de conexão. Tente novamente.', status: 0, ok: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Cache leve + invalidação por tag
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_TTL_MS = 45_000;
const STATS_TTL_MS = 15_000;

interface CacheEntry {
  result: ApiResult<unknown>;
  expiresAt: number;
  tags: readonly string[];
}

const cache = new Map<string, CacheEntry>();
// Coalesce de requests em voo pra mesma URL — evita duplo-fetch em
// hover + click rápido ou em mount duplo do StrictMode em dev. Cada entrada
// carrega a versão em que foi criada; se uma invalidação aconteceu depois,
// callers novos NÃO reusam esse promise (senão receberiam dado pré-mutation).
interface InFlightEntry {
  promise: Promise<ApiResult<unknown>>;
  version: number;
}
const inFlight = new Map<string, InFlightEntry>();
// Contador global incrementado a cada invalidateTags(). GETs em voo capturam
// o valor ao iniciar e só gravam no cache se a versão não mudou — evita que
// um GET disparado por hover ANTES da mutation "revida" um resultado
// pré-mutation no cache e mantenha dado velho pelos próximos 45s.
let cacheVersion = 0;

interface CacheOptions {
  ttl?: number;
  tags: readonly string[];
}

async function cachedGet<T>(url: string, opts: CacheOptions): Promise<ApiResult<T>> {
  const now = Date.now();
  const existing = cache.get(url);
  if (existing && existing.expiresAt > now) {
    return existing.result as ApiResult<T>;
  }

  const pending = inFlight.get(url);
  // Só reusa pending se começou na versão atual. Pending de antes de uma
  // invalidação resolve com dado stale — callers novos precisam de fetch novo.
  if (pending && pending.version === cacheVersion) {
    return pending.promise as Promise<ApiResult<T>>;
  }

  const ttl = opts.ttl ?? DEFAULT_TTL_MS;
  const versionAtStart = cacheVersion;
  const runFetch = async (): Promise<ApiResult<T>> => {
    const result = await apiFetch<T>(url);
    // Só grava se nenhuma invalidação aconteceu durante o await — senão,
    // esse GET iniciou contra dados pré-mutation e o resultado está stale.
    if (result.ok && cacheVersion === versionAtStart) {
      cache.set(url, { result, expiresAt: Date.now() + ttl, tags: opts.tags });
    }
    return result;
  };

  const promise = runFetch();
  // Só remove se o entry atual ainda for o NOSSO — uma invalidação pode ter
  // substituído esta entrada por um fetch novo enquanto estávamos em voo.
  promise.finally(() => {
    const current = inFlight.get(url);
    if (current && current.promise === promise) {
      inFlight.delete(url);
    }
  });

  inFlight.set(url, { promise, version: versionAtStart });
  return promise;
}

// Invalida todas as entradas que carregam qualquer uma das tags passadas.
// Incrementa a versão global pra neutralizar GETs em voo (que não escrevem
// no cache ao resolver se a versão mudou). Chamado por mutations ok.
function invalidateTags(tagsToBust: readonly string[]): void {
  cacheVersion++;
  const set = new Set(tagsToBust);
  for (const [url, entry] of cache) {
    if (entry.tags.some((t) => set.has(t))) {
      cache.delete(url);
    }
  }
}

// Envolve uma mutation: se der ok, invalida as tags. Mantém a API pública
// das resource modules limpa (apenas `(...args) => Promise<ApiResult<T>>`).
async function withInvalidation<T>(
  mutation: () => Promise<ApiResult<T>>,
  tags: readonly string[],
): Promise<ApiResult<T>> {
  const res = await mutation();
  if (res.ok) invalidateTags(tags);
  return res;
}

// helpers internos — "del" porque "delete" é palavra reservada do JS
function post<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function put<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function patch<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function del<T = void>(url: string): Promise<ApiResult<T>> {
  return apiFetch<T>(url, { method: 'DELETE' });
}

// --- endpoints por recurso ---

// Tags de invalidação em clients incluem 'schedule' porque:
// - update pode trocar contract.professionalId (afeta getExistingYears/listByYear)
// - delete cascata contratos e appointments
// - create não toca schedule mas mantemos a tag por consistência/safety
export const clientsApi = {
  list: () => cachedGet<Client[]>('/api/clients', { tags: ['clients'] }),
  create: (data: Record<string, unknown>) =>
    withInvalidation(() => post<Client>('/api/clients', data), ['clients', 'stats', 'schedule']),
  update: (id: string, data: Record<string, unknown>) =>
    withInvalidation(
      () => put<Client>(`/api/clients/${id}`, data),
      ['clients', 'stats', 'schedule'],
    ),
  delete: (id: string) =>
    withInvalidation(() => del(`/api/clients/${id}`), ['clients', 'stats', 'schedule']),
};

// Tags em professionals incluem 'clients' e 'schedule' porque:
// - clientsApi.list() traz contracts com professional aninhado (update/delete muda)
// - create pode vincular contracts via contractIds
// - delete cascata contratos/agendamentos
export const professionalsApi = {
  list: () => cachedGet<Professional[]>('/api/professionals', { tags: ['professionals'] }),
  getById: (id: string) =>
    cachedGet<Professional>(`/api/professionals/${id}`, { tags: ['professionals'] }),
  create: (data: Record<string, unknown>) =>
    withInvalidation(
      () => post<Professional>('/api/professionals', data),
      ['professionals', 'stats', 'clients', 'schedule'],
    ),
  update: (id: string, data: Record<string, unknown>) =>
    withInvalidation(
      () => put<Professional>(`/api/professionals/${id}`, data),
      ['professionals', 'stats', 'clients', 'schedule'],
    ),
  delete: (id: string) =>
    withInvalidation(
      () => del(`/api/professionals/${id}`),
      ['professionals', 'stats', 'clients', 'schedule'],
    ),
};

export const holidaysApi = {
  list: (year?: number) =>
    cachedGet<Holiday[]>(year ? `/api/holidays?year=${year}` : '/api/holidays', {
      tags: ['holidays'],
    }),
  create: (data: { date: string; name: string }) =>
    withInvalidation(() => post<Holiday>('/api/holidays', data), ['holidays']),
  delete: (id: string) => withInvalidation(() => del(`/api/holidays/${id}`), ['holidays']),
};

export const staffApi = {
  list: () => cachedGet<InternalContact[]>('/api/internal-contacts', { tags: ['staff'] }),
  getById: (id: string) =>
    cachedGet<InternalContact>(`/api/internal-contacts/${id}`, { tags: ['staff'] }),
  create: (data: Record<string, unknown>) =>
    withInvalidation(() => post<InternalContact>('/api/internal-contacts', data), ['staff']),
  update: (id: string, data: Record<string, unknown>) =>
    withInvalidation(() => put<InternalContact>(`/api/internal-contacts/${id}`, data), ['staff']),
  delete: (id: string) => withInvalidation(() => del(`/api/internal-contacts/${id}`), ['staff']),
};

// schedule é o mais complexo — generate, listagem por ano, CRUD manual e limpeza.
// Invalidações coarse-grained em 'schedule': um update em (prof=A, ano=2025)
// busta também (prof=A, ano=2026) em cache — aceita-se o re-fetch pontual em
// troca de invalidação simples (sem tag composta por prof/ano).
export const scheduleApi = {
  preview: (professionalId: string, year: number) =>
    post<SchedulePreviewData>('/api/schedule/generate/preview', {
      professionalId,
      year,
    }),
  generate: (professionalId: string, year: number) =>
    withInvalidation(
      () =>
        post<{ message: string; count: number; contractCount: number }>('/api/schedule/generate', {
          professionalId,
          year,
        }),
      ['schedule', 'stats'],
    ),
  getExistingYears: (professionalId: string) =>
    cachedGet<{ years: number[] }>(`/api/schedule/generate?professionalId=${professionalId}`, {
      tags: ['schedule'],
    }),
  listByYear: (professionalId: string, year: number) =>
    cachedGet<Appointment[]>(
      `/api/schedule/generate?professionalId=${professionalId}&year=${year}`,
      { tags: ['schedule'] },
    ),
  create: (data: Record<string, unknown>) =>
    withInvalidation(() => post<Appointment>('/api/schedule', data), ['schedule', 'stats']),
  update: (id: string, data: Record<string, unknown>) =>
    withInvalidation(() => patch<Appointment>(`/api/schedule/${id}`, data), ['schedule', 'stats']),
  delete: (id: string) => withInvalidation(() => del(`/api/schedule/${id}`), ['schedule', 'stats']),
  clearYear: (professionalId: string, year: number) =>
    withInvalidation(
      () =>
        del<{ message: string }>(
          `/api/schedule/generate?professionalId=${professionalId}&year=${year}`,
        ),
      ['schedule', 'stats'],
    ),
};

export const contactsApi = {
  get: (contractId: string) =>
    cachedGet<{ maintenance: Partial<Contact>[]; escalation: Partial<Contact>[] }>(
      `/api/contracts/${contractId}/contacts`,
      { tags: ['contacts'] },
    ),
  // Contatos ficam dentro de contracts.contactsJson → mutação também afeta
  // lista de clients (que traz contratos aninhados).
  save: (contractId: string, data: unknown) =>
    withInvalidation(
      () => patch(`/api/contracts/${contractId}/contacts`, data),
      ['contacts', 'clients'],
    ),
};

export const statsApi = {
  get: () =>
    cachedGet<{
      clients: number;
      professionals: number;
      totalContracts: number;
      contractsWithSchedule: number;
      contractsDetail: {
        id: string;
        clientName: string;
        professionalName: string | null;
        systemTypes: string | null;
        hasSchedule: boolean;
      }[];
    }>('/api/stats', { tags: ['stats'], ttl: STATS_TTL_MS }),
};
