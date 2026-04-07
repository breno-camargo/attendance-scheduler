'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const colors = {
    success: { bg: 'var(--primary-subtle)', border: 'var(--primary)', icon: '\u2713' },
    error: { bg: 'var(--danger-bg)', border: 'var(--danger)', icon: '\u2717' },
    info: { bg: 'var(--warning-bg)', border: 'var(--warning)', icon: '\u2139' },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: '1rem',
              right: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              zIndex: 10000,
              pointerEvents: 'none',
            }}
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '8px',
                  background: colors[t.type].bg,
                  border: `1px solid ${colors[t.type].border}`,
                  color: 'white',
                  fontSize: '0.9rem',
                  animation: 'toastIn 0.3s ease-out',
                  pointerEvents: 'auto',
                }}
              >
                <span style={{ marginRight: '8px', fontWeight: 700 }}>{colors[t.type].icon}</span>
                {t.message}
              </div>
            ))}
            <style>{`
            @keyframes toastIn {
              from { opacity: 0; transform: translateX(100%); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
