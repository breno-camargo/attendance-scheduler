import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const data = await request.json();
    const contact = await prisma.internalContact.update({
      where: { id: params.id },
      data: {
        name: data.name,
        role: data.role || null,
        phone: data.phone || null,
        email: data.email || null,
      },
    });
    return NextResponse.json(contact);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao atualizar contato", details: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.internalContact.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao excluir contato", details: error.message },
      { status: 500 },
    );
  }
}
