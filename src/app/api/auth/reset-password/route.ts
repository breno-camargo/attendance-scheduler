import bcrypt from 'bcryptjs';

import { ApiUtils } from '@/lib/api-utils';
import { audit } from '@/lib/audit';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return ApiUtils.error('Token e nova senha são obrigatórios', null, 400);
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return ApiUtils.error('A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra e um número', null, 400);
    }

    // Transaction atômica pra evitar race condition (mesmo token usado 2x simultâneo)
    const hash = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.updateMany({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
      data: {
        password: hash,
        mustChangePassword: false,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    if (updated.count === 0) {
      return ApiUtils.error('Link expirado ou inválido. Solicite um novo.', null, 400);
    }

    audit({ event: 'PASSWORD_RESET_COMPLETED', details: `token used` });

    return ApiUtils.success({ success: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao redefinir senha', error);
  }
}
