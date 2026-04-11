/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const rawUsername = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!rawUsername || !password) {
    console.error('ADMIN_USERNAME e ADMIN_PASSWORD são obrigatórios no .env');
    process.exit(1);
  }

  // Aceita email completo — extrai só o username
  const username = rawUsername.includes('@') ? rawUsername.split('@')[0] : rawUsername;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`User "${username}" already exists, skipping.`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      username,
      password: hash,
      name: 'Admin',
    },
  });

  console.log(`Admin user "${username}" created successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
