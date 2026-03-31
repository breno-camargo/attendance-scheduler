import type { Metadata } from "next";
import "./globals.css";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "Agendador CompaSSS",
  description: "Sistema de Gestão de Manutenção Preventiva - CompaSSS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Anti-flash: aplica o tema salvo ANTES do React renderizar, evitando piscar */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('compasss_theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <Header />
        <main className="animate-fade-in" key="main-page-wrapper">
          {children}
        </main>
      </body>
    </html>
  );
}
