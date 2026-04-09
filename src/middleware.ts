import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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

  // Página de troca de senha é sempre acessível pra quem tá logado

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|api/ping|_next/static|_next/image|icon\\.png|favicon.ico|login|reset-password|logo|icons|corner).*)'],
};
