import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendResetPasswordEmail(to: string, resetUrl: string) {
  const recipientName = to.split('@')[0].split('.').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const logoUrl = `${baseUrl}/logo-email.png`;

  await transporter.sendMail({
    from: `"CompaSSS" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: 'Recuperação de Senha — CompaSSS',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff;">
        <!-- Header -->
        <div style="background: #0a0a0a; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <img src="${logoUrl}" alt="CompaSSS" width="180" style="width: 180px; height: auto;" />
          <p style="color: rgba(255,255,255,0.4); margin: 10px 0 0; font-size: 10px; text-transform: uppercase; letter-spacing: 3px;">Gerador de Agenda</p>
        </div>

        <!-- Green accent line -->
        <div style="height: 3px; background: linear-gradient(90deg, #22c55e, #4ade80, #22c55e);"></div>

        <!-- Body -->
        <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #1a1a2e; font-size: 16px; font-weight: 600; margin: 0 0 8px;">
            Olá, ${recipientName}
          </p>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.7; margin: 0 0 28px;">
            Recebemos uma solicitação para redefinir a senha da sua conta.
            Clique no botão abaixo para criar uma nova senha.
          </p>

          <!-- Button -->
          <div style="text-align: center; margin: 0 0 28px;">
            <a href="${resetUrl}" style="
              display: inline-block;
              background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
              color: #ffffff;
              padding: 16px 40px;
              border-radius: 10px;
              text-decoration: none;
              font-weight: 700;
              font-size: 14px;
              letter-spacing: 0.3px;
              box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
            ">Redefinir Minha Senha</a>
          </div>

          <!-- Info box -->
          <div style="background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; padding: 14px 16px; margin: 0 0 20px;">
            <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0;">
              Este link expira em <strong style="color: #16a34a;">1 hora</strong>.
              Se você não solicitou esta redefinição, ignore este e-mail — sua senha permanece inalterada.
            </p>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center;">
            <p style="color: #d1d5db; font-size: 11px; margin: 0;">
              CompaSSS — Companhia de Parceria em Soluções e Serviços em Segurança
            </p>
          </div>
        </div>
      </div>
    `,
  });
}
