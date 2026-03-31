/** Tipos compartilhados do domínio — usados em componentes e API routes */

export interface Professional {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface Client {
  id: string;
  name: string;
  phone?: string | null;
  contracts?: Contract[];
}

export interface Contract {
  id: string;
  clientId: string;
  professionalId: string | null;
  professional?: Professional;
  systemTypes?: string | null;
  visitsPerMonth: number;
  frequency: 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
  targetMonths?: string | null;
  preferredDays?: string | null;
  contactsJson?: string | null;
  active: boolean;
}

export interface Appointment {
  id: string;
  date: string;
  type: 'VISITA_TECNICA' | 'TESTE_SDAI';
  contractId: string | null;
  observation: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  client?: { id: string; name: string };
  professional?: { id: string; name: string };
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  fixed: boolean;
}

export interface InternalContact {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
}

/** Contato editável dentro de uma lista de contatos de contrato */
export interface Contact {
  action?: string;
  contact?: string;
  role: string;
  name: string;
  phone: string;
  email: string;
}
