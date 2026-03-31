import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const contacts = await prisma.internalContact.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(contacts);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao buscar equipe interna", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const contact = await prisma.internalContact.create({
      data: {
        name: data.name,
        role: data.role || null,
        phone: data.phone || null,
        email: data.email || null,
      },
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao cadastrar equipe", details: error.message },
      { status: 500 },
    );
  }
}
