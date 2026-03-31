import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { professionalSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/professionals
 * Retorna todos os técnicos cadastrados.
 */
export async function GET() {
  try {
    const professionals = await prisma.professional.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(professionals);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao listar técnicos", details: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/professionals
 * Cria um novo técnico com validação de dados (Ponto 3 da Auditoria).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validação com Zod
    const validation = professionalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.format() },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Lógica de e-mail automático (se enviado apenas o prefixo)
    const emailPrefix = data.email || "";
    const email =
      emailPrefix && !emailPrefix.includes("@")
        ? `${emailPrefix}@compasss.com.br`
        : emailPrefix;

    if (!email) {
      return NextResponse.json(
        { error: "E-mail é obrigatório" },
        { status: 400 },
      );
    }

    const professional = await prisma.professional.create({
      data: {
        name: data.name,
        email,
        phone: data.phone || null,
      },
    });

    return NextResponse.json(professional, { status: 201 });
  } catch (error: any) {
    console.error("Erro na rota POST /api/professionals:", error);
    return NextResponse.json(
      {
        error: "Erro interno ao criar técnico",
        details: error.message,
        code: error.code,
      },
      { status: 500 },
    );
  }
}
