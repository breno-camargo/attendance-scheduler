'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Logo } from '@/components/ui/logo';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao alterar senha.');
        return;
      }

      // Atualiza a sessão pra remover mustChangePassword
      await update();
      router.push('/');
      router.refresh();
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
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

        <h2 style={{ textAlign: 'center', margin: '0 0 0.5rem', fontSize: '1.2rem' }}>
          {session?.user?.mustChangePassword ? 'Defina sua nova senha' : 'Alterar Senha'}
        </h2>
        {session?.user?.mustChangePassword && (
          <p
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              margin: '0 0 1.5rem',
            }}
          >
            Este é seu primeiro acesso. Por segurança, escolha uma senha pessoal.
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}
        >
          <div className="form-field">
            <label className="form-label" htmlFor="new-password">
              Nova Senha
            </label>
            <input
              id="new-password"
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
            <label className="form-label" htmlFor="confirm-password">
              Confirmar Senha
            </label>
            <input
              id="confirm-password"
              className="form-input"
              type="password"
              placeholder="Repita a senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? 'Salvando...' : 'Salvar Senha'}
          </button>
        </form>
      </div>
    </main>
  );
}
