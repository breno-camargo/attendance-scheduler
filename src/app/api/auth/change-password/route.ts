import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';

import { ApiUtils } from '@/lib/api-utils';
import { audit } from '@/lib/audit';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkChangePasswordRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return ApiUtils.error('Não autorizado', null, 401);
  }

  try {
    const allowed = await checkChangePasswordRateLimit(session.user.id);
    if (!allowed) {
      return ApiUtils.error('Muitas tentativas. Aguarde alguns minutos.', null, 429);
    }

    const { currentPassword, newPassword } = await request.json();

    if (
      !currentPassword ||
      !newPassword ||
      newPassword.length < 8 ||
      !/[a-zA-Z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      return ApiUtils.error(
        'A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra e um número',
        null,
        400,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });
    if (!user) {
      return ApiUtils.error('Não autorizado', null, 401);
    }

    const currentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!currentPasswordValid) {
      audit({ event: 'PASSWORD_CHANGE_FAILED', userId: session.user.id });
      return ApiUtils.error('Senha atual incorreta', null, 401);
    }

    const samePassword = await bcrypt.compare(newPassword, user.password);
    if (samePassword) {
      return ApiUtils.error('A nova senha deve ser diferente da senha atual', null, 400);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hash, mustChangePassword: false },
    });

    audit({ event: 'PASSWORD_CHANGED', userId: session.user.id });

    return ApiUtils.success({ success: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao alterar senha', error);
  }
}
