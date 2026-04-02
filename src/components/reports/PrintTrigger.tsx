'use client';

export default function PrintTrigger() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        padding: '0.75rem 1.5rem',
        borderRadius: '0.5rem',
        border: 'none',
        background: '#3b82f6',
        color: 'white',
        cursor: 'pointer',
        fontSize: '1rem',
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
      className="no-print"
      aria-label="Imprimir relatório"
    >
      Imprimir
    </button>
  );
}
