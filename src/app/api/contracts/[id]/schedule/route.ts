import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        client: true,
        professional: true,
        appointments: {
          orderBy: { date: "asc" },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrato não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(contract);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Erro ao buscar dados do contrato para o relatório",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
