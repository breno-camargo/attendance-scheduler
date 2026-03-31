'use client';

export default function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: 'calc(100vh - 100px)',
        gap: '20px',
      }}
    >
      <div
        style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(16, 185, 129, 0.1)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          fontWeight: '500',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}
      >
        Carregando Módulo CompaSSS...
      </p>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
