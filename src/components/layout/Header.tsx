'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/ui/logo';

export default function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('compasss_theme') as 'dark' | 'light' | null;
    const systemPref = window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
    const initial = saved || systemPref;
    setTheme(initial); // eslint-disable-line react-hooks/set-state-in-effect -- sync com localStorage
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false); // eslint-disable-line react-hooks/set-state-in-effect -- reset ao navegar
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('compasss_theme', next);
    // pequeno delay pra sincronizar com o início da transição CSS
    setTimeout(() => {
      const color = next === 'light' ? '#ffffff' : '#111111';
      const tc = document.querySelector('meta[name="theme-color"]');
      if (tc) tc.setAttribute('content', color);
      else {
        const m = document.createElement('meta');
        m.name = 'theme-color';
        m.content = color;
        document.head.appendChild(m);
      }
    }, 150);
  };

  if (pathname.startsWith('/reports') || pathname === '/login') return null;

  const navLinks = [
    { name: 'Dashboard', href: '/' },
    { name: 'Clientes', href: '/clients' },
    { name: 'Técnicos', href: '/professionals' },
    { name: 'Equipe', href: '/staff' },
    { name: 'Calendário', href: '/calendar' },
    { name: 'Feriados', href: '/holidays' },
    { name: 'Importar', href: '/import' },
  ];

  const themeTitle = theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
  const themeIcon = theme === 'dark' ? '☀️' : '🌙';

  return (
    <>
      <header className="topbar">
        <div className="topbar-logo">
          <h1>
            <Link href="/">
              <Logo size="md" />
            </Link>
          </h1>
        </div>

        {/* Desktop nav */}
        <nav className="desktop-nav">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link"
                aria-current={active ? 'page' : undefined}
              >
                {link.name}
                <span className="nav-link__underline" aria-hidden="true" />
              </Link>
            );
          })}
        </nav>

        {/* Desktop user area */}
        <div className="desktop-user">
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle"
            title={themeTitle}
            aria-label="Alternar tema"
          >
            {themeIcon}
          </button>
          <div className="user-info">
            {status === 'loading' ? (
              <>
                <span className="skeleton skeleton-bar skeleton-bar--lg" aria-hidden="true" />
                <span className="skeleton skeleton-bar skeleton-bar--sm" aria-hidden="true" />
                <span className="sr-only">Carregando informações do usuário</span>
              </>
            ) : (
              <>
                <p className="user-info__name">{session?.user?.name ?? ''}</p>
                <p className="user-info__role">
                  {(session?.user as { role?: string } | undefined)?.role ?? ''}
                </p>
              </>
            )}
          </div>
          <Link href="/change-password" title="Alterar senha" className="icon-circle-btn">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Sair"
            aria-label="Sair"
            className="icon-circle-btn"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="mobile-controls">
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle hamburger-btn"
            title={themeTitle}
            aria-label="Alternar tema"
          >
            {themeIcon}
          </button>
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile nav overlay */}
      {menuOpen && (
        <nav className="mobile-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'active' : ''}
              aria-current={pathname === link.href ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="mobile-signout"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair da conta
          </button>
        </nav>
      )}
    </>
  );
}
