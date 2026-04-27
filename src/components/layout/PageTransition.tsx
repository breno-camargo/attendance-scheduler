'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="page-transition" key={pathname}>
      {children}
    </main>
  );
}
