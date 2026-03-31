import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { clientSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** 
 * GET /api/clients
 * Retorna todos os clientes com seus contratos e técnico vinculado.
 */
export async function GET() {
  const clients = await prisma.client.findMany({
    include: { contracts: { include: { professional: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(clients);
}

/**
 * POST /api/clients
 * Cria um novo cliente e seu contrato inicial em uma única operação.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validação com Zod para garantir integridade dos dados (Ponto 3 da Auditoria)
    const validation = clientSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.format() },
        { status: 400 },
      );
    }

    const data = validation.data;

    const client = await prisma.client.create({
      data: {
        name: data.name,
        contracts: {
          create: {
            professionalId: data.professionalId || null,
            systemTypes: data.systemTypes || "SDAI",
            visitsPerMonth: data.visitsPerMonth,
            frequency: data.frequency,
            targetMonths: data.targetMonths || null,
            preferredDays: data.preferredDays || null,
          },
        },
      },
      include: { contracts: { include: { professional: true } } },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error: any) {
    console.error("Erro na rota POST /api/clients:", error);
    return NextResponse.json(
      { error: "Erro interno ao criar cliente", details: error.message },
      { status: 500 },
    );
  }
}
