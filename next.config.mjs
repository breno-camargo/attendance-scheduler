/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Relatórios não podem ser cacheados pelo browser — dados mudam
        // (nome do cliente, contatos, agenda) e PDF gerado via window.print
        // precisa sempre refletir o estado atual do banco.
        source: '/reports/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value:
              process.env.NODE_ENV === 'development'
                ? ''
                : "default-src 'self'; script-src 'self' 'unsafe-inline'; worker-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
