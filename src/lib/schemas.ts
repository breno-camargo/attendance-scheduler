import { z } from "zod";

// Esquema para Clientes (Prédios/Shoppings)
export const clientSchema = z.object({
  name: z.string().min(2, "Nome do cliente é obrigatório"),
  visitsPerMonth: z.string().or(z.number()).transform(v => Number(v) || 2),
  frequency: z.enum(["MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]),
  targetMonths: z.string().optional(),
  professionalId: z.string().optional(),
  systemTypes: z.string().optional(),
  preferredDays: z.string().optional(),
});

// Esquema para Profissionais (Técnicos)
export const professionalSchema = z.object({
  name: z.string().min(2, "Nome do profissional é obrigatório"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

// Esquema para Contatos (Manutenção e Escalonamento)
export const contactsSchema = z.object({
  maintenance: z.array(z.object({
    action: z.string().optional(),
    role: z.string().min(1),
    name: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
  })),
  escalation: z.array(z.object({
    contact: z.string().optional(),
    role: z.string().min(1),
    name: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
  })),
});
