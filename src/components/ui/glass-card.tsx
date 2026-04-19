import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hoverable?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  style = {},
  hoverable = true,
}) => {
  const baseStyles: React.CSSProperties = {
    background: 'var(--card-bg)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid var(--primary-border-subtle)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
    transition:
      'transform 0.3s var(--ease-out-expo), box-shadow 0.3s var(--ease-out-expo), border-color 0.3s var(--ease-out-expo)',
    position: 'relative',
    overflow: 'hidden',
    ...style,
  };

  return (
    <div className={`glass-card ${hoverable ? 'hoverable' : ''} ${className}`} style={baseStyles}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--primary-subtle), transparent)',
          opacity: 0.8,
        }}
      />
      {children}
    </div>
  );
};
