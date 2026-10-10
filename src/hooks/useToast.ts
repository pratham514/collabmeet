import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'info' | 'success' | 'error';

export interface ToastState {
  show: boolean;
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });
  const timer = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    window.clearTimeout(timer.current);
    setToast({ show: true, message, type });
    timer.current = window.setTimeout(() => {
      // keep message/type so the text doesn't change while the toast slides out
      setToast((t) => ({ ...t, show: false }));
    }, 4000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { toast, showToast };
}
