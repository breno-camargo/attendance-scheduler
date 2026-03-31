import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/schedule
 * Cria um agendamento manual (visita técnica ou teste SDAI).
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();

    const appointment = await prisma.appointment.create({
      data: {
        clientId: data.clientId,
        professionalId: data.professionalId,
        contractId: data.contractId,
        date: new Date(data.date),
        type: data.type || "VISITA_TECNICA",
        observation: data.observation || "",
      },
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao criar agendamento", details: error.message },
      { status: 500 },
    );
  }
}
