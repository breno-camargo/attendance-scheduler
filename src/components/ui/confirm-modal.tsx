'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

export function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  variant = 'danger',
}: ConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Foca no botão de cancelar por segurança (evita exclusão acidental)
    const timer = setTimeout(
      () =>
        confirmBtnRef.current?.parentElement
          ?.querySelector<HTMLButtonElement>('.confirm-cancel-btn')
          ?.focus(),
      50,
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel]);

  if (!isOpen || typeof document === 'undefined') return null;

  const accentColor = variant === 'danger' ? 'var(--danger)' : 'var(--warning)';

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <section
        className="glass-panel modal-panel animate-fade-in"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        style={{ maxWidth: '420px', padding: '1.8rem 2rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            borderRadius: '12px 12px 0 0',
          }}
        />

        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: variant === 'danger' ? 'var(--danger-bg)' : 'var(--warning-bg)',
              border: `1px solid ${variant === 'danger' ? 'var(--danger-border)' : 'var(--warning-border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              flexShrink: 0,
            }}
          >
            {variant === 'danger' ? '🗑' : '⚠'}
          </div>
          <h3
            id="confirm-title"
            style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.3px' }}
          >
            {title}
          </h3>
        </div>

        {/* Message */}
        <p
          id="confirm-message"
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.92rem',
            lineHeight: 1.6,
            margin: '0 0 1.5rem 0',
            paddingLeft: '52px',
          }}
        >
          {message}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn-secondary confirm-cancel-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

/**
 * Hook para usar o ConfirmModal de forma imperativa (substitui window.confirm).
 *
 * Uso:
 *   const [confirmModal, confirm] = useConfirm();
 *   // No handler:
 *   const ok = await confirm({ title: "...", message: "..." });
 *   if (!ok) return;
 *   // No JSX:
 *   {confirmModal}
 */
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

export function useConfirm(): [React.ReactNode, (opts: ConfirmOptions) => Promise<boolean>] {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ opts, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const modal = state ? (
    <ConfirmModal
      isOpen={true}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      title={state.opts.title}
      message={state.opts.message}
      confirmLabel={state.opts.confirmLabel}
      cancelLabel={state.opts.cancelLabel}
      variant={state.opts.variant}
    />
  ) : null;

  return [modal, confirm];
}
