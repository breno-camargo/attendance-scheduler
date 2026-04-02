/**
 * Layout especial para a seção de Relatórios.
 *
 * Por que isso existe?
 * O layout raiz da aplicação (src/app/layout.tsx) renderiza o
 * componente <Header> (a barra de navegação preta) em TODAS as páginas.
 * Ao criar um layout próprio para a pasta /reports, o Next.js usa
 * ESTE layout no lugar do global apenas para as rotas filhas,
 * eliminando o Header indesejado que aparecia no meio do PDF.
 */
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
});

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    // Renderiza apenas o conteúdo filho, sem Header nem footer.
    <div className={montserrat.className}>{children}</div>
  );
}
