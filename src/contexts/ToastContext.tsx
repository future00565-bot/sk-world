import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] md:bottom-6 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 shadow-lg text-sm text-slate-900 dark:text-slate-100"
          >
            {toast.kind === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
            {toast.kind === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
            {toast.kind === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  return useContext(ToastContext);
}
