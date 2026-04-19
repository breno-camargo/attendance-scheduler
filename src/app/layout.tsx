import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';

import '@/styles/globals.css';
import Header from '@/components/layout/Header';
import SessionTimeout from '@/components/layout/SessionTimeout';

import Providers from './providers';

const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '600', '800'] });

export const metadata: Metadata = {
  title: 'Gerador de Agenda CompaSSS',
  description: 'Sistema de Gestão de Manutenção Preventiva - CompaSSS',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CompaSSS',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href="/logo.png" />
        {/* Script externo (public/init.js) aplica tema antes do React renderizar
            e registra o service worker. Externo pra permitir CSP sem unsafe-inline. */}
        <script src="/init.js" />
      </head>
      <body className={outfit.className}>
        <Providers>
          <Header />
          <SessionTimeout />
          <main className="animate-fade-in" key="main-page-wrapper">
            {children}
          </main>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
