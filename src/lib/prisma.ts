import { PrismaClient } from '@prisma/client';

/**
 * Padrão de Arquitetura "Singleton"
 * Em Next.js (no modo de desenvolvimento local), o servidor recarrega muito rápido a cada "Ctrl+S".
 * Se apenas criarmos um `new PrismaClient()` toda vez, corremos o risco de abrir centenas de
 * conexões repetidas ao banco de dados, esgotando o limite do servidor.
 */

// 1. Cria a instância pura do Prisma
const prismaClientSingleton = () => new PrismaClient();

// 2. Transforma o contexto "Global" do JavaScript/Node para guardar nossa conexão.
declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

/**
 * 3. O operador "??" (Nullish Coalescing) faz o truque:
 * "Se já existir uma conexão armazenada (globalThis.prismaGlobal), reaproveite-a.
 * Senão, gere uma nova conexão."
 */
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export default prisma;
