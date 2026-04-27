'use client';

import { SessionProvider } from 'next-auth/react';

import { ToastProvider } from '@/components/ui/toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
