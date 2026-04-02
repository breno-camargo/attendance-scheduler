'use client';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

import { Logo } from '@/components/ui/logo';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      setLoading(false);

      if (res?.error) {
        setError('Usuário ou senha incorretos.');
      } else if (res?.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Erro ao tentar fazer login. Tente novamente.');
      }
    } catch {
      setLoading(false);
      setError('Falha de conexão. Verifique sua internet.');
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        className="glass-panel"
        style={{ width: '100%', maxWidth: '420px', position: 'relative', padding: '2.5rem' }}
      >
        {/* Accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background:
              'linear-gradient(90deg, transparent, var(--primary), var(--accent), transparent)',
            borderRadius: '12px 12px 0 0',
          }}
        />

        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 0.6rem 0', display: 'flex', justifyContent: 'center' }}>
            <Logo size="md" />
          </h1>
        </div>

        <div
          style={{
            height: '1px',
            background: 'var(--primary-border-subtle)',
            marginBottom: '2rem',
          }}
        />

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}
        >
          <div className="form-field">
            <label className="form-label" htmlFor="login-username">
              Usuário
            </label>
            <input
              id="login-username"
              className="form-input"
              type="text"
              placeholder="usuario@compasss.com.br"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="login-password">
              Senha
            </label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p style={{ color: 'var(--danger, #f87171)', fontSize: '0.85rem', margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: '0.5rem', padding: '0.9rem' }}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
