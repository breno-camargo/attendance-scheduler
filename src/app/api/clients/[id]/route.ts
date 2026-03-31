import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * PUT /api/clients/[id]
 * Atualiza o nome do cliente e os dados do seu contrato principal.
 * Se o contrato não existir, cria um novo automaticamente.
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const data = await request.json();

    const client = await prisma.client.findUnique({
      where: { id },
      include: { contracts: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 },
      );
    }

    const contractId = client.contracts[0]?.id;

    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        name: data.name,
        contracts: contractId
          ? {
              update: {
                where: { id: contractId },
                data: {
                  professionalId: data.professionalId || null,
                  systemTypes: data.systemTypes,
                  visitsPerMonth: parseInt(data.visitsPerMonth) || 2,
                  frequency: data.frequency || "MONTHLY",
                  targetMonths: data.targetMonths || null,
                  preferredDays: data.preferredDays || null,
                },
              },
            }
          : {
              create: {
                professionalId: data.professionalId || null,
                systemTypes: data.systemTypes || "SDAI",
                visitsPerMonth: parseInt(data.visitsPerMonth) || 2,
                frequency: data.frequency || "MONTHLY",
                targetMonths: data.targetMonths || null,
                preferredDays: data.preferredDays || null,
              },
            },
      },
      include: { contracts: { include: { professional: true } } },
    });

    return NextResponse.json(updatedClient);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao atualizar cliente", details: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/clients/[id]
 * Remove o cliente e todos os dados vinculados (contratos, agendamentos).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao excluir cliente", details: error.message },
      { status: 500 },
    );
  }
}
