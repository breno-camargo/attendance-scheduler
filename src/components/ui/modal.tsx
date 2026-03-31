'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = '480px' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstEl = focusableElements[0];
    const lastEl = focusableElements[focusableElements.length - 1];

    firstEl?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    }

    modal.addEventListener('keydown', handleKeyDown);
    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        ref={modalRef}
        className="glass-panel modal-panel animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent line no topo */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background:
              'linear-gradient(90deg, transparent, var(--primary), var(--accent), transparent)',
            borderRadius: '12px 12px 0 0',
          }}
        />

        <div className="modal-header">
          <div>
            <div
              style={{
                width: '28px',
                height: '3px',
                background: 'var(--primary)',
                borderRadius: '2px',
                marginBottom: '8px',
              }}
            />
            <h2
              id="modal-title"
              style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.5px' }}
            >
              {title}
            </h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            &times;
          </button>
        </div>

        <div
          style={{
            height: '1px',
            background: 'var(--primary-border-subtle)',
            marginBottom: '1.5rem',
          }}
        />

        {children}
      </section>
    </div>,
    document.body,
  );
}
