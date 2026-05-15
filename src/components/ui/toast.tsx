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
              bottom: '1.5rem',
              right: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              // Acima de .modal-backdrop (99999) — toast precisa cobrir modais
              // abertos pra erro de validação ser visível ao salvar.
              zIndex: 100000,
              pointerEvents: 'none',
            }}
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '10px',
                  background: 'var(--surface-solid)',
                  border: `1px solid ${colors[t.type].border}`,
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                  backdropFilter: 'blur(12px)',
                  animation: 'toastIn 0.3s ease-out',
                  pointerEvents: 'auto',
                }}
              >
                <span style={{ marginRight: '8px', fontWeight: 700, color: colors[t.type].border }}>
                  {colors[t.type].icon}
                </span>
                {t.message}
              </div>
            ))}
            <style>{`
            @keyframes toastIn {
              from { opacity: 0; transform: translateY(1rem); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
