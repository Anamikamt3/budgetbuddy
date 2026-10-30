import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: '', type: '', show: false });
  const timer = useRef(null);

  // toast('Saved')  or  toast('Something failed', 'error')
  const show = useCallback((message, type) => {
    clearTimeout(timer.current);
    setToast({ message, type, show: true });
    timer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200);
  }, []);

  const className = `toast${toast.show ? ' show' : ''}${toast.type === 'error' ? ' error' : ''}`;

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={className} role="status">{toast.message}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
