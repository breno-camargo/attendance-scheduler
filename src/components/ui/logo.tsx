/* eslint-disable @next/next/no-img-element */

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ size = 'md' }: LogoProps) {
  const heights = {
    sm: 70,
    md: 95,
    lg: 115,
  };

  return (
    <img
      src="/logo-compasss.png"
      alt="CompaSSS"
      style={{
        height: `${heights[size]}px`,
        width: 'auto',
        objectFit: 'contain',
        transition: 'opacity 0.3s ease',
      }}
    />
  );
}
