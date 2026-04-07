// Wrapper de fetch pro frontend — evita repetir try/catch e JSON.parse em todo lugar.
// Cada recurso da API tem suas funções tipadas embaixo.

import type { Appointment, Client, Contact, Holiday, InternalContact, Professional } from '@/types';

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

export const clientsApi = {
  list: () => apiFetch<Client[]>('/api/clients'),
  create: (data: Record<string, unknown>) => post<Client>('/api/clients', data),
  update: (id: string, data: Record<string, unknown>) => put<Client>(`/api/clients/${id}`, data),
  delete: (id: string) => del(`/api/clients/${id}`),
};

export const professionalsApi = {
  list: () => apiFetch<Professional[]>('/api/professionals'),
  create: (data: Record<string, unknown>) => post<Professional>('/api/professionals', data),
  update: (id: string, data: Record<string, unknown>) =>
    put<Professional>(`/api/professionals/${id}`, data),
  delete: (id: string) => del(`/api/professionals/${id}`),
};

export const holidaysApi = {
  list: () => apiFetch<Holiday[]>('/api/holidays'),
  create: (data: { date: string; name: string }) => post<Holiday>('/api/holidays', data),
  delete: (id: string) => del(`/api/holidays/${id}`),
};

export const staffApi = {
  list: () => apiFetch<InternalContact[]>('/api/internal-contacts'),
  create: (data: Record<string, unknown>) => post<InternalContact>('/api/internal-contacts', data),
  update: (id: string, data: Record<string, unknown>) =>
    put<InternalContact>(`/api/internal-contacts/${id}`, data),
  delete: (id: string) => del(`/api/internal-contacts/${id}`),
};

// schedule é o mais complexo — generate, listagem por ano, CRUD manual e limpeza
export const scheduleApi = {
  generate: (professionalId: string, year: number) =>
    post<{ message: string; count: number }>('/api/schedule/generate', { professionalId, year }),
  getExistingYear: (professionalId: string) =>
    apiFetch<{ existingYear: number | null }>(
      `/api/schedule/generate?professionalId=${professionalId}`,
    ),
  listByYear: (professionalId: string, year: number) =>
    apiFetch<Appointment[]>(`/api/schedule/generate?professionalId=${professionalId}&year=${year}`),
  create: (data: Record<string, unknown>) => post<Appointment>('/api/schedule', data),
  update: (id: string, data: Record<string, unknown>) =>
    patch<Appointment>(`/api/schedule/${id}`, data),
  delete: (id: string) => del(`/api/schedule/${id}`),
  clearYear: (professionalId: string, year: number) =>
    del(`/api/schedule/generate?professionalId=${professionalId}&year=${year}`),
};

export const contactsApi = {
  get: (contractId: string) =>
    apiFetch<{ maintenance: Partial<Contact>[]; escalation: Partial<Contact>[] }>(
      `/api/contracts/${contractId}/contacts`,
    ),
  save: (contractId: string, data: unknown) => patch(`/api/contracts/${contractId}/contacts`, data),
};

export const statsApi = {
  get: () =>
    apiFetch<{ clients: number; professionals: number; generatedSchedules: number }>('/api/stats'),
};
