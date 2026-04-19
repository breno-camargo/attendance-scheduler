import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  // Proteção CSRF: requests mutáveis devem vir do mesmo origin
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Não autenticado → login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Precisa trocar senha → redireciona (exceto se já tá na página ou na API)
  const isChangePasswordPage = request.nextUrl.pathname === '/change-password';
  const isChangePasswordApi = request.nextUrl.pathname.startsWith('/api/auth/change-password');

  if (token.mustChangePassword && !isChangePasswordPage && !isChangePasswordApi) {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // sw.js e manifest.json precisam ser públicos pro PWA funcionar. offline.html
    // é servido pelo SW em modo offline. Sem isso, o browser recebe o HTML do
    // login em vez do JS do SW e nunca atualiza pra versão nova.
    '/((?!api/auth|api/ping|_next/static|_next/image|icon\\.png|favicon.ico|login|reset-password|logo|icons|corner|sw\\.js|manifest\\.json|offline\\.html|init\\.js).*)',
  ],
};
