import type { NextRequest } from 'next/server';

import { ApiUtils, requireAuthWithScope, requireContractInScope } from '@/lib/api-utils';
import prisma from '@/lib/prisma';
import { contactsSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts/[id]/contacts
 * Retorna a lista de contatos (Manutenção e Escalonamento) do contrato.
 * PII é mantido aqui conforme a necessidade da visão de detalhe.
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  try {
    if (!params.id || !/^c[a-z0-9]{24}$/.test(params.id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }
    const scopeError = await requireContractInScope(auth, params.id);
    if (scopeError) return scopeError;

    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { contactsJson: true },
    });

    if (!contract) {
      return ApiUtils.error('Contrato não encontrado', null, 404);
    }

    let contacts;
    try {
      contacts = contract.contactsJson ? JSON.parse(contract.contactsJson) : defaultContacts;
    } catch {
      contacts = defaultContacts;
    }

    return ApiUtils.success(contacts);
  } catch (error: unknown) {
    return ApiUtils.error('Falha ao buscar contatos', error);
  }
}

/**
 * PATCH /api/contracts/[id]/contacts
 * Salva a lista de contatos editada com validação.
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  try {
    if (!params.id || !/^c[a-z0-9]{24}$/.test(params.id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }
    const scopeError = await requireContractInScope(auth, params.id);
    if (scopeError) return scopeError;

    const body = await req.json();

    // Validação estrutural do JSON de contatos
    const validation = contactsSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Estrutura de contatos inválida', validation.error.format(), 400);
    }

    const json = JSON.stringify(validation.data);

    // Atualiza o campo usando o ORM padrão
    await prisma.contract.update({
      where: { id: params.id },
      data: { contactsJson: json },
    });

    return ApiUtils.success({ ok: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro interno ao salvar contatos', error);
  }
}

// Estrutura padrão de contatos quando nenhum foi salvo ainda
const defaultContacts = {
  maintenance: [
    {
      action: '2° Contato',
      role: 'Técnico de Sistemas Líder',
      name: '',
      phone: '',
      email: '',
    },
    { action: '', role: 'Supervisor', name: '', phone: '', email: '' },
    {
      action: '3° Contato',
      role: 'Coordenador',
      name: '',
      phone: '',
      email: '',
    },
  ],
  escalation: [
    {
      contact: 'Setor Comercial',
      role: 'Comercial Obras/Peças',
      name: '',
      phone: '',
      email: '',
    },
    { contact: '', role: 'Comercial Serviços', name: '', phone: '', email: '' },
    {
      contact: 'Manutenção Sistemas',
      role: 'Gerente',
      name: '',
      phone: '',
      email: '',
    },
    {
      contact: 'Operação de Segurança',
      role: 'Diretor',
      name: '',
      phone: '',
      email: '',
    },
    { contact: '', role: '', name: '', phone: '', email: '' },
  ],
};
