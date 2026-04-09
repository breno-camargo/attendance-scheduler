'use client';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/ui/logo';

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('compasss_theme') as 'dark' | 'light' | null;
    const initial = saved || 'dark';
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

  return (
    <>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ margin: 0 }}>
            <Logo size="md" />
          </h1>
        </div>

        {/* Desktop nav */}
        <nav className="desktop-nav" style={{ display: 'flex', gap: '2rem' }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
              style={{
                textDecoration: 'none',
                color: pathname === link.href ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '0.95rem',
                fontWeight: pathname === link.href ? '700' : '500',
                transition: 'var(--transition-smooth)',
                position: 'relative',
              }}
            >
              {link.name}
              <span
                style={{
                  position: 'absolute',
                  bottom: '-4px',
                  left: '0',
                  width: pathname === link.href ? '100%' : '0',
                  height: '2px',
                  background: 'var(--primary)',
                  borderRadius: '2px',
                  transition: 'var(--transition-smooth)',
                  opacity: pathname === link.href ? 1 : 0,
                }}
              />
            </Link>
          ))}
        </nav>

        {/* Desktop user area */}
        <div
          className="desktop-user"
          style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}
        >
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--foreground)' }}>
              {session?.user?.name || 'Usuário'}
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {session?.user?.role || 'Compasss Brasil'}
            </p>
          </div>
          <Link
            href="/change-password"
            title="Alterar senha"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--input-bg)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'var(--transition-smooth)',
              textDecoration: 'none',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Sair"
            aria-label="Sair"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--input-bg)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'var(--transition-smooth)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          className="mobile-controls"
        >
          <button
            onClick={toggleTheme}
            className="theme-toggle hamburger-btn"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label="Alternar tema"
            style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
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
              onClick={() => setMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              marginTop: 'auto',
              width: '100%',
              padding: '0.9rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              color: '#ef4444',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
