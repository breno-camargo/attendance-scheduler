import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

function buildCsp(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const scriptSrc = isDevelopment
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `script-src-elem 'self' 'nonce-${nonce}' https:`,
    "worker-src 'self'",
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
    `style-src-elem 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
    "img-src 'self' data:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://vitals.vercel-insights.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  if (!isDevelopment) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

function withCsp(request: NextRequest, response: NextResponse): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);
  return response;
}

function nextWithCsp(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);
  return response;
}

export async function proxy(request: NextRequest) {
  // Proteção CSRF: requests mutáveis devem vir do mesmo origin
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');
    if (host) {
      const source = origin || referer;
      if (!source) {
        return withCsp(request, NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
      }

      let sourceHost: string;
      try {
        sourceHost = new URL(source).host;
      } catch {
        return withCsp(request, NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
      }

      if (sourceHost !== host) {
        return withCsp(request, NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
      }
    }
  }

  const publicPaths = ['/login', '/reset-password'];
  const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Não autenticado → login
  if (!token) {
    if (isPublicPath) return nextWithCsp(request);
    return withCsp(request, NextResponse.redirect(new URL('/login', request.url)));
  }

  // Precisa trocar senha → redireciona (exceto se já tá na página ou na API)
  const isChangePasswordPage = request.nextUrl.pathname === '/change-password';
  const isChangePasswordApi = request.nextUrl.pathname.startsWith('/api/auth/change-password');

  if (token.mustChangePassword && !isChangePasswordPage && !isChangePasswordApi) {
    return withCsp(request, NextResponse.redirect(new URL('/change-password', request.url)));
  }

  return nextWithCsp(request);
}

export const config = {
  matcher: [
    // sw.js e manifest.json precisam ser públicos pro PWA funcionar. offline.html
    // é servido pelo SW em modo offline. Sem isso, o browser recebe o HTML do
    // login em vez do JS do SW e nunca atualiza pra versão nova.
    '/((?!api/auth|api/ping|_next/static|_next/image|icon\\.png|favicon.ico|logo|icons|corner|sw\\.js|manifest\\.json|offline\\.html|init\\.js).*)',
  ],
};
