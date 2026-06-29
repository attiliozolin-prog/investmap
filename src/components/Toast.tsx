'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import styles from './Toast.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  exiting?: boolean;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return ctx;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error:   <AlertCircle size={18} />,
  info:    <Info size={18} />,
};

const TYPE_CLASS: Record<ToastType, string> = {
  success: styles.toastSuccess,
  error:   styles.toastError,
  info:    styles.toastInfo,
};

// ─── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    // Marca como saindo para animar
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    // Remove após a animação
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 250);
    // Limpa o timer se existir
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);

    // Auto-dismiss após 3.5s
    const timer = setTimeout(() => dismissToast(id), 3500);
    timersRef.current.set(id, timer);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className={styles.toastContainer} role="status" aria-live="polite">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`${styles.toast} ${TYPE_CLASS[t.type]}`}
            data-exiting={t.exiting ? 'true' : undefined}
          >
            <span className={styles.toastIcon}>{ICONS[t.type]}</span>
            <span className={styles.toastMessage}>{t.message}</span>
            <button
              className={styles.toastClose}
              onClick={() => dismissToast(t.id)}
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
