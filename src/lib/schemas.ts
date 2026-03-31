import { z } from 'zod';

// Esquema para Clientes (Prédios/Shoppings)
export const clientSchema = z.object({
  name: z.string().min(2, 'Nome do cliente é obrigatório').max(200),
  phone: z.string().max(20).optional().or(z.literal('')),
  visitsPerMonth: z
    .string()
    .or(z.number())
    .transform((v) => Number(v) || 2),
  frequency: z.enum(['MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  targetMonths: z.string().max(50).optional(),
  professionalId: z.string().max(50).optional(),
  systemTypes: z.string().max(200).optional(),
  preferredDays: z.string().max(20).optional(),
});

// Esquema para Profissionais (Técnicos)
export const professionalSchema = z.object({
  name: z.string().min(2, 'Nome do profissional é obrigatório').max(200),
  email: z.string().min(1, 'E-mail é obrigatório').max(200).email('E-mail inválido'),
  phone: z.string().max(20).optional().or(z.literal('')),
});

// Esquema para Equipe Interna
export const internalContactSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  role: z.string().max(100).optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().max(200).optional().or(z.literal('')),
});

// Esquema para Agendamentos Manuais
export const appointmentSchema = z.object({
  clientId: z.string().min(1, 'clientId é obrigatório'),
  professionalId: z.string().min(1, 'professionalId é obrigatório'),
  contractId: z.string().optional().nullable(),
  date: z
    .string()
    .min(1, 'Data é obrigatória')
    .refine((v) => !isNaN(Date.parse(v)), 'Data inválida'),
  type: z.enum(['VISITA_TECNICA', 'TESTE_SDAI']).default('VISITA_TECNICA'),
  observation: z.string().max(500).optional().default(''),
});

// Esquema para Atualização Parcial de Agendamento
export const appointmentPatchSchema = z.object({
  type: z.enum(['VISITA_TECNICA', 'TESTE_SDAI']).optional(),
  observation: z.string().max(500).optional(),
  date: z.string().optional(),
});

// Esquema para Geração de Agenda
export const generateScheduleSchema = z.object({
  professionalId: z.string().min(1, 'professionalId é obrigatório'),
  year: z
    .number()
    .or(z.string().transform((v) => Number(v)))
    .pipe(z.number().int().min(2020).max(2100))
    .optional()
    .default(new Date().getFullYear()),
});

// Esquema para Feriados
export const holidaySchema = z.object({
  date: z
    .string()
    .min(1, 'Data é obrigatória')
    .refine((v) => !isNaN(Date.parse(v)), 'Data inválida'),
  name: z.string().min(1, 'Nome do feriado é obrigatório').max(200),
});

const contactPersonSchema = z.object({
  action: z.string().optional(),
  contact: z.string().optional(),
  role: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
});

export const contactsSchema = z.object({
  maintenance: z.array(contactPersonSchema).max(20),
  escalation: z.array(contactPersonSchema).max(20),
});
