'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

import { Logo } from '@/components/ui/logo';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <p style={{ color: 'var(--danger)', textAlign: 'center' }}>
        Link inválido. Solicite um novo na tela de login.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError('A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra e um número.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao redefinir senha.');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ margin: '0 0 0.5rem' }}>Senha redefinida!</h2>
        <p style={{ color: 'var(--text-muted)' }}>Redirecionando para o login...</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}
    >
      <h2 style={{ textAlign: 'center', margin: '0 0 0.5rem', fontSize: '1.2rem' }}>Nova Senha</h2>
      <div className="form-field">
        <label className="form-label" htmlFor="reset-password">
          Nova Senha
        </label>
        <input
          id="reset-password"
          className="form-input"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="reset-confirm">
          Confirmar Senha
        </label>
        <input
          id="reset-confirm"
          className="form-input"
          type="password"
          placeholder="Repita a senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && (
        <p style={{ color: 'var(--danger, #f87171)', fontSize: '0.85rem', margin: 0 }}>{error}</p>
      )}
      <button
        type="submit"
        className="btn-primary"
        style={{ padding: '0.9rem' }}
        disabled={loading}
      >
        {loading ? 'Salvando...' : 'Redefinir Senha'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
            marginBottom: '1.5rem',
          }}
        />
        <Suspense
          fallback={
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</p>
          }
        >
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
