import { Analytics } from '@vercel/analytics/next';
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
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
        {/* Anti-flash: aplica o tema salvo ANTES do React renderizar, evitando piscar */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('compasss_theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                  var tc = document.querySelector('meta[name="theme-color"]');
                  if (tc) tc.setAttribute('content', theme === 'light' ? '#ffffff' : '#111111');
                } catch(e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
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
