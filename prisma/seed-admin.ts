/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || '123456';

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
