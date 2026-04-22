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
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

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
        setError('E-mail ou senha incorretos.');
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
    <div
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
          style={{ display: forgotMode ? 'none' : 'flex', flexDirection: 'column', gap: '1.4rem' }}
        >
          <div className="form-field">
            <label className="form-label" htmlFor="login-username">
              E-mail
            </label>
            <input
              id="login-username"
              className="form-input"
              type="email"
              placeholder="nome@compasss.com.br"
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

        <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
          {!forgotMode ? (
            <button
              type="button"
              onClick={() => setForgotMode(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                padding: 0,
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Não consegue acessar? <span style={{ fontWeight: 600 }}>Recuperar senha</span>
            </button>
          ) : forgotSent ? (
            <div
              style={{
                padding: '1.2rem',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.06)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>📩</div>
              <p
                style={{
                  color: 'var(--foreground)',
                  fontWeight: 600,
                  margin: '0 0 0.3rem',
                  fontSize: '0.95rem',
                }}
              >
                E-mail enviado!
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 1rem' }}>
                Verifique sua caixa de entrada e clique no link para redefinir sua senha.
              </p>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.82rem' }}
                onClick={() => {
                  setForgotMode(false);
                  setForgotSent(false);
                  setForgotEmail('');
                }}
              >
                Voltar ao login
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: '1.2rem',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.04)',
                border: '1px solid var(--primary-border-subtle)',
              }}
            >
              <p
                style={{
                  color: 'var(--foreground)',
                  fontWeight: 600,
                  margin: '0 0 0.8rem',
                  fontSize: '0.9rem',
                }}
              >
                Recuperar senha
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setForgotLoading(true);
                  setForgotError('');
                  try {
                    const res = await fetch('/api/auth/forgot-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: forgotEmail }),
                    });
                    if (res.ok) {
                      setForgotSent(true);
                    } else {
                      const data = await res.json();
                      setForgotError(data.error || 'Erro ao enviar e-mail');
                    }
                  } catch {
                    setForgotError('Falha de conexão. Tente novamente.');
                  }
                  setForgotLoading(false);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
              >
                <input
                  className="form-input"
                  type="email"
                  placeholder="seu.email@compasss.com.br"
                  value={forgotEmail}
                  onChange={(e) => {
                    setForgotEmail(e.target.value);
                    setForgotError('');
                  }}
                  required
                  autoFocus
                  style={{ fontSize: '0.9rem' }}
                />
                {forgotError && (
                  <p style={{ color: 'var(--danger, #f87171)', fontSize: '0.82rem', margin: 0 }}>
                    {forgotError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Enviando...' : 'Enviar link de recuperação'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '0.75rem', fontSize: '0.85rem' }}
                    onClick={() => {
                      setForgotMode(false);
                      setForgotSent(false);
                    }}
                  >
                    Voltar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
