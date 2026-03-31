import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * PUT /api/professionals/[id]
 * Atualiza os dados de um técnico existente.
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const data = await request.json();

    const email = data.email?.includes("@")
      ? data.email
      : `${data.email}@compasss.com.br`;

    const updated = await prisma.professional.update({
      where: { id },
      data: {
        name: data.name,
        email,
        phone: data.phone || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao editar técnico", details: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/professionals/[id]
 * Remove um técnico e limpa todos os vínculos (disponibilidades, contratos, agendamentos).
 * Usa uma transação para garantir consistência.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { professionalId: id } }),
      prisma.contract.updateMany({
        where: { professionalId: id },
        data: { professionalId: null },
      }),
      prisma.appointment.updateMany({
        where: { professionalId: id },
        data: { professionalId: null },
      }),
      prisma.professional.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao excluir técnico", details: error.message },
      { status: 500 },
    );
  }
}
