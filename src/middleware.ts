export { default } from 'next-auth/middleware';

export const config = {
  matcher: ['/((?!api/auth|api/ping|_next/static|_next/image|icon\\.png|favicon.ico|login).*)'],
};
