import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'warning';
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  className = '',
  style = {},
}) => {
  const getStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--primary-subtle)',
          color: 'var(--primary)',
          border: '1px solid var(--border)',
        };
      case 'secondary':
        return {
          background: 'var(--surface-subtle)',
          color: 'var(--text-muted)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        };
      case 'outline':
        return {
          background: 'transparent',
          color: 'var(--primary)',
          border: '1px solid var(--primary)',
        };
      case 'danger':
        return {
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          border: '1px solid var(--danger-border)',
        };
      case 'warning':
        return {
          background: 'var(--warning-bg)',
          color: 'var(--warning)',
          border: '1px solid var(--warning-border)',
        };
      default:
        return {};
    }
  };

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    backdropFilter: 'blur(4px)',
    ...getStyles(),
    ...style,
  };

  return (
    <span className={className} style={baseStyles}>
      {children}
    </span>
  );
};
