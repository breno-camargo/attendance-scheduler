interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ size = 'md' }: LogoProps) {
  const sizes = {
    sm: { icon: 28, font: '1.4rem' },
    md: { icon: 36, font: '1.8rem' },
    lg: { icon: 44, font: '2.2rem' },
  };
  const { icon, font } = sizes[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '1px',
        letterSpacing: '-1px',
        fontSize: font,
        fontWeight: 900,
        color: 'var(--foreground)',
        transition: 'color 0.4s ease',
      }}
    >
      <span>C</span>
      <svg width={icon} height={icon} viewBox="0 0 100 100" style={{ margin: '0 -1px 0 -1px' }}>
        <circle cx="50" cy="50" r="43" stroke="var(--primary)" strokeWidth="7" fill="none" />
        <circle
          cx="50"
          cy="50"
          r="27"
          stroke="var(--primary)"
          strokeWidth="3.5"
          fill="none"
          strokeDasharray="38 5"
          strokeDashoffset="19"
        />
        <circle cx="50" cy="7" r="4.5" fill="var(--foreground)" />
        <circle cx="50" cy="93" r="4.5" fill="var(--foreground)" />
        <circle cx="7" cy="50" r="4.5" fill="var(--foreground)" />
        <circle cx="93" cy="50" r="4.5" fill="var(--foreground)" />
        <path
          d="M50,32 L53,42 L63,37 L58,47 L68,50 L58,53 L63,63 L53,58 L50,68 L47,58 L37,63 L42,53 L32,50 L42,47 L37,37 L47,42 Z"
          fill="var(--primary)"
        />
      </svg>
      <span>
        mpa<span style={{ color: 'var(--primary)' }}>SSS</span>
      </span>
    </span>
  );
}
