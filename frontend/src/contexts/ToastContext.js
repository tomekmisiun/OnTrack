import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, color = '#ef4444', ms = 3500) => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), ms);
  }, []);

  const showSuccess = useCallback((msg, ms) => showToast(msg, '#0d9488', ms), [showToast]);
  const showError   = useCallback((msg, ms) => showToast(msg, '#ef4444', ms), [showToast]);
  const showInfo    = useCallback((msg, ms) => showToast(msg, '#3b82f6', ms), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo }}>
      {children}
      {toast && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: toast.color, color: 'white',
          padding: '16px 28px', borderRadius: 12,
          fontSize: 15, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          zIndex: 9999, pointerEvents: 'none',
          textAlign: 'center', maxWidth: '80vw',
        }}>
          {toast.msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
