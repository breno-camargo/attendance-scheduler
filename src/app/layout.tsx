import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import Script from 'next/script';

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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/logo.png" />
        {/* next/script com beforeInteractive carrega antes de qualquer hydration,
            garantindo que o tema seja aplicado sem flash. */}
        <Script src="/init.js" strategy="beforeInteractive" />
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
