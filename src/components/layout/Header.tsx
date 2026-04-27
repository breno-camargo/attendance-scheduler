'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { Logo } from '@/components/ui/logo';
import { clientsApi, holidaysApi, professionalsApi, staffApi, statsApi } from '@/lib/api-client';

// Prefetch das APIs principais quando o usuário passa mouse/foco no item do
// menu. O api-client faz cache leve (TTL 45s) e coalesce de requests em voo,
// então dupla-chamada é barata. Calendário aquece só profs/clients — agenda
// depende de professionalId+year e seria palpite errado.
const routeWarmers: Record<string, () => void> = {
  '/': () => {
    void statsApi.get();
  },
  '/clients': () => {
    void clientsApi.list();
    void professionalsApi.list();
  },
  '/professionals': () => {
    void professionalsApi.list();
  },
  '/staff': () => {
    void staffApi.list();
  },
  '/calendar': () => {
    void professionalsApi.list();
    void clientsApi.list();
  },
  '/holidays': () => {
    void holidaysApi.list(new Date().getFullYear());
  },
};

const navLinks = [
  { name: 'Dashboard', href: '/' },
  { name: 'Clientes', href: '/clients' },
  { name: 'Técnicos', href: '/professionals' },
  { name: 'Equipe', href: '/staff' },
  { name: 'Calendário', href: '/calendar' },
  { name: 'Feriados', href: '/holidays' },
  { name: 'Importar', href: '/import' },
];

export default function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [navIndicator, setNavIndicator] = useState({ left: 0, width: 0, visible: false });
  const navRef = useRef<HTMLElement | null>(null);
  const navLinkRefs = useRef<Array<HTMLAnchorElement | null>>([]);

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

  useEffect(() => {
    const activeIndex = navLinks.findIndex((link) => link.href === pathname);
    const activeLink = activeIndex >= 0 ? navLinkRefs.current[activeIndex] : null;
    const nav = navRef.current;

    if (!activeLink || !nav) {
      requestAnimationFrame(() => {
        setNavIndicator((current) => ({ ...current, visible: false }));
      });
      return;
    }

    const updateIndicator = () => {
      const linkRect = activeLink.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();

      setNavIndicator({
        left: linkRect.left - navRect.left,
        width: linkRect.width,
        visible: true,
      });
    };

    updateIndicator();

    const observer = new ResizeObserver(updateIndicator);
    observer.observe(nav);
    observer.observe(activeLink);
    window.addEventListener('resize', updateIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [pathname]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;

    const apply = () => {
      setTheme(next);
      root.setAttribute('data-theme', next);
      localStorage.setItem('compasss_theme', next);

      const color = next === 'light' ? '#ffffff' : '#111111';
      const tc = document.querySelector('meta[name="theme-color"]');
      if (tc) tc.setAttribute('content', color);
      else {
        const m = document.createElement('meta');
        m.name = 'theme-color';
        m.content = color;
        document.head.appendChild(m);
      }
    };

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Mantém .theme-switching durante toda a transição pra impedir que
    // transições internas de componentes compitam com o fade do overlay.
    root.classList.add('theme-switching');

    if (prefersReduced) {
      apply();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => root.classList.remove('theme-switching'));
      });
      return;
    }

    // Captura a cor do fundo ATUAL antes de trocar o tema. O overlay entra
    // opaco com essa cor — o usuário continua vendo o mesmo fundo. Trocamos
    // data-theme por baixo (invisível), e o overlay faz fade-out revelando
    // o tema novo. Sem snapshot da viewport, sem raster de backdrop-filter.
    const oldBg = getComputedStyle(root).getPropertyValue('--background').trim();
    const overlay = document.createElement('div');
    overlay.className = 'theme-transition-overlay';
    overlay.style.backgroundColor = oldBg;
    document.body.appendChild(overlay);
    // Força reflow pra opacity:1 ser commitada antes de pedir o fade-out.
    void overlay.offsetWidth;

    apply();

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      overlay.remove();
      root.classList.remove('theme-switching');
    };
    overlay.addEventListener('transitionend', cleanup, { once: true });
    // safety: garante cleanup mesmo se transitionend não disparar (aba em
    // background, interrupção do compositor, etc.)
    window.setTimeout(cleanup, 500);

    requestAnimationFrame(() => {
      overlay.style.opacity = '0';
    });
  };

  if (pathname.startsWith('/reports') || pathname === '/login') return null;

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
        <nav className="desktop-nav" ref={navRef}>
          {navLinks.map((link, index) => {
            const active = pathname === link.href;
            const warm = routeWarmers[link.href];
            return (
              <Link
                key={link.href}
                ref={(node) => {
                  navLinkRefs.current[index] = node;
                }}
                href={link.href}
                className="nav-link"
                aria-current={active ? 'page' : undefined}
                onMouseEnter={warm}
                onFocus={warm}
              >
                {link.name}
              </Link>
            );
          })}
          <span
            className="desktop-nav__indicator"
            style={{
              opacity: navIndicator.visible ? 1 : 0,
              transform: `translateX(${navIndicator.left}px)`,
              width: `${navIndicator.width}px`,
            }}
            aria-hidden="true"
          />
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
              onTouchStart={routeWarmers[link.href]}
              onFocus={routeWarmers[link.href]}
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
