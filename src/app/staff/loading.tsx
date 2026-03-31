'use client';

export default function Loading() {
  return (
    <div style={{ padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '3rem',
        }}
      >
        <div
          style={{
            width: '400px',
            height: '40px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
          }}
        />
        <div
          style={{
            width: '150px',
            height: '45px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="glass-panel"
            style={{
              height: '100px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              width: '100%',
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.7;
          }
          100% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}
