'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--danger, #ef4444)' }}>
        Algo deu errado
      </h2>
      <p style={{ color: 'var(--text-muted, #94a3b8)', marginBottom: '2rem' }}>
        {error.message || 'Ocorreu um erro inesperado.'}
      </p>
      <button onClick={reset} className="btn-primary" style={{ padding: '0.75rem 2rem' }}>
        Tentar novamente
      </button>
    </div>
  );
}
