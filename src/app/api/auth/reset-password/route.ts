import bcrypt from 'bcryptjs';

import { ApiUtils } from '@/lib/api-utils';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return ApiUtils.error('Token e nova senha são obrigatórios', null, 400);
    }

    if (newPassword.length < 6) {
      return ApiUtils.error('A senha deve ter no mínimo 6 caracteres', null, 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      return ApiUtils.error('Link expirado ou inválido. Solicite um novo.', null, 400);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hash,
        mustChangePassword: false,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return ApiUtils.success({ success: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao redefinir senha', error);
  }
}
