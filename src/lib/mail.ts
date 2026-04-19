import path from 'path';

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: parseInt(process.env.SMTP_PORT || '587') === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendResetPasswordEmail(to: string, resetUrl: string) {
  const recipientName = to
    .split('@')[0]
    .split('.')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const logoPath = path.join(process.cwd(), 'public', 'logo-email.png');

  await transporter.sendMail({
    from: `"CompaSSS" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: 'Recuperação de Senha — CompaSSS',
    html: `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <!--[if mso]>
        <style type="text/css">
          body, table, td { font-family: Segoe UI, Arial, sans-serif !important; }
        </style>
        <![endif]-->
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
          <tr>
            <td align="center" style="padding: 24px 0;">
              <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; width: 100%; background-color: #ffffff;">
                <!-- Header -->
                <tr>
                  <td align="center" style="background-color: #0a0a0a; padding: 28px 32px;">
                    <img src="cid:logo" alt="CompaSSS" width="180" style="display: block; width: 180px; height: auto; border: 0;" />
                    <p style="color: #666666; margin: 10px 0 0; font-size: 10px; text-transform: uppercase; letter-spacing: 3px; font-family: Segoe UI, Arial, sans-serif;">Gerador de Agenda</p>
                  </td>
                </tr>

                <!-- Green accent line -->
                <tr>
                  <td style="background-color: #22c55e; height: 3px; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; font-family: Segoe UI, Arial, sans-serif;">
                    <p style="color: #1a1a2e; font-size: 16px; font-weight: 600; margin: 0 0 8px; font-family: Segoe UI, Arial, sans-serif;">
                      Olá, ${recipientName}
                    </p>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.7; margin: 0 0 28px; font-family: Segoe UI, Arial, sans-serif;">
                      Recebemos uma solicitação para redefinir a senha da sua conta.
                      Clique no botão abaixo para criar uma nova senha.
                    </p>

                    <!-- Bulletproof Button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding: 0 0 28px;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${resetUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" strokecolor="#16a34a" fillcolor="#16a34a">
                            <w:anchorlock/>
                            <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:14px;font-weight:bold;">Redefinir Minha Senha</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${resetUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; font-family: Segoe UI, Arial, sans-serif; mso-hide: all;">Redefinir Minha Senha</a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>

                    <!-- Info box -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="background-color: #f0fdf4; border: 1px solid #dcfce7; padding: 14px 16px;">
                          <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0; font-family: Segoe UI, Arial, sans-serif;">
                            Este link expira em <strong style="color: #16a34a;">1 hora</strong>.
                            Se você não solicitou esta redefinição, ignore este e-mail — sua senha permanece inalterada.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Footer -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 20px;">
                      <tr>
                        <td style="border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center;">
                          <p style="color: #6b7280; font-size: 11px; margin: 0; font-family: Segoe UI, Arial, sans-serif;">
                            Equipe | CompaSSS
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: 'logo-email.png',
        path: logoPath,
        cid: 'logo',
      },
    ],
  });
}
