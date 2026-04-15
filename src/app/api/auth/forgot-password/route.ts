import crypto from 'crypto';

import { ApiUtils } from '@/lib/api-utils';
import { audit } from '@/lib/audit';
import { sendResetPasswordEmail } from '@/lib/mail';
import prisma from '@/lib/prisma';
import { checkForgotPasswordRateLimit } from '@/lib/rate-limit';

// Resposta genérica pra não revelar se o email existe ou não (anti-enumeração)
const GENERIC_RESPONSE = ApiUtils.success({ sent: true });

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return ApiUtils.error('E-mail é obrigatório', null, 400);
    }

    const trimmed = email.trim().toLowerCase();

    // Rate limit por IP — máx 3 tentativas por hora
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const allowed = await checkForgotPasswordRateLimit(ip);
    if (!allowed) {
      return ApiUtils.error('Muitas tentativas. Aguarde alguns minutos.', null, 429);
    }

    // Extrai username do email
    const username = trimmed.split('@')[0];

    const user = await prisma.user.findUnique({ where: { username } });

    // Retorna mesma resposta se user não existe — impede enumeração de contas
    if (!user) {
      return GENERIC_RESPONSE;
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
    audit({ event: 'PASSWORD_RESET_REQUESTED', userId: user.id, ip });

    return GENERIC_RESPONSE;
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao processar solicitação', error);
  }
}
