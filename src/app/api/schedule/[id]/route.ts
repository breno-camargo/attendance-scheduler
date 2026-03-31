import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * DELETE /api/schedule/[id]
 * Remove um agendamento específico.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    await prisma.appointment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao excluir agendamento", details: error.message },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/schedule/[id]
 * Atualiza parcialmente um agendamento (tipo, observação ou data).
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const { type, observation, date } = await request.json();

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(observation && { observation }),
        ...(date && { date: new Date(date) }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao atualizar agendamento", details: error.message },
      { status: 500 },
    );
  }
}
