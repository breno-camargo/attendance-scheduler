import crypto from 'crypto';

import { ApiUtils } from '@/lib/api-utils';
import { sendResetPasswordEmail } from '@/lib/mail';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return ApiUtils.error('E-mail é obrigatório', null, 400);
    }

    // Extrai username do email
    const username = email.trim().toLowerCase().split('@')[0];

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return ApiUtils.error('Nenhuma conta encontrada com este e-mail', null, 404);
    }

    // Gera token e salva no banco (expira em 1 hora)
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    // Monta URL de reset
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Envia email
    const emailDomain = process.env.EMAIL_DOMAIN || 'compasss.com.br';
    const userEmail = `${username}@${emailDomain}`;
    await sendResetPasswordEmail(userEmail, resetUrl);

    return ApiUtils.success({ sent: true });
  } catch (error: unknown) {
    console.error('Forgot password error:', error);
    return ApiUtils.error('Erro ao processar solicitação', null);
  }
}
