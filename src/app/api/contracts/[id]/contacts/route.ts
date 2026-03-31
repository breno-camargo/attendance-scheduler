import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { contactsSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** 
 * GET /api/contracts/[id]/contacts
 * Retorna a lista de contatos (Manutenção e Escalonamento) do contrato.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    select: { contactsJson: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contacts = contract.contactsJson
    ? JSON.parse(contract.contactsJson)
    : defaultContacts;

  return NextResponse.json(contacts);
}

/**
 * PATCH /api/contracts/[id]/contacts
 * Salva a lista de contatos editada com validação (Ponto 3 da Auditoria).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();

    // Validação estrutural do JSON de contatos
    const validation = contactsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Estrutura de contatos inválida", details: validation.error.format() },
        { status: 400 },
      );
    }

    const json = JSON.stringify(validation.data);

    // Atualiza o campo usando o ORM padrão
    await prisma.contract.update({
      where: { id: params.id },
      data: { contactsJson: json },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Erro na rota PATCH /api/contacts:", error);
    return NextResponse.json(
      { error: "Erro interno ao salvar contatos", details: error.message },
      { status: 500 },
    );
  }
}

// Estrutura padrão de contatos quando nenhum foi salvo ainda
const defaultContacts = {
  maintenance: [
    {
      action: "2° Contato",
      role: "Técnico de Sistemas Líder",
      name: "",
      phone: "",
      email: "",
    },
    { action: "", role: "Supervisor", name: "", phone: "", email: "" },
    {
      action: "3° Contato",
      role: "Coordenador",
      name: "",
      phone: "",
      email: "",
    },
  ],
  escalation: [
    {
      contact: "Setor Comercial",
      role: "Comercial Obras/Peças",
      name: "",
      phone: "",
      email: "",
    },
    { contact: "", role: "Comercial Serviços", name: "", phone: "", email: "" },
    {
      contact: "Manutenção Sistemas",
      role: "Gerente",
      name: "",
      phone: "",
      email: "",
    },
    {
      contact: "Operação de Segurança",
      role: "Diretor",
      name: "",
      phone: "",
      email: "",
    },
    { contact: "", role: "", name: "", phone: "", email: "" },
  ],
};
