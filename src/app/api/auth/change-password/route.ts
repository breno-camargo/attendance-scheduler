import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { ApiUtils } from '@/lib/api-utils';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return ApiUtils.error('Não autorizado', null, 401);
  }

  try {
    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return ApiUtils.error('A senha deve ter no mínimo 6 caracteres', null, 400);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hash, mustChangePassword: false },
    });

    return ApiUtils.success({ success: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao alterar senha', error);
  }
}
