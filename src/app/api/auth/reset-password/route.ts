import bcrypt from 'bcryptjs';

import { ApiUtils, getClientIp } from '@/lib/api-utils';
import { audit } from '@/lib/audit';
import prisma from '@/lib/prisma';
import { checkResetPasswordRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const allowed = await checkResetPasswordRateLimit(ip);
    if (!allowed) {
      return ApiUtils.error('Muitas tentativas. Aguarde alguns minutos.', null, 429);
    }

    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return ApiUtils.error('Token e nova senha são obrigatórios', null, 400);
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return ApiUtils.error(
        'A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra e um número',
        null,
        400,
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
      select: { id: true, password: true },
    });

    if (!user) {
      return ApiUtils.error('Link expirado ou inválido. Solicite um novo.', null, 400);
    }

    const samePassword = await bcrypt.compare(newPassword, user.password);
    if (samePassword) {
      return ApiUtils.error('A nova senha deve ser diferente da senha atual', null, 400);
    }

    // updateMany consome o token de forma atômica: se dois submits competirem, só um atualiza.
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
