import React, { createContext, useContext, useState, useCallback } from 'react';
import { useLanguage } from './LanguageContext';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const { t } = useLanguage();
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const showToast = useCallback((msg, color = '#ef4444', ms = 3000) => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), ms);
  }, []);

  const showSuccess = useCallback((msg, ms) => showToast(msg, '#0d9488', ms), [showToast]);
  const showError   = useCallback((msg, ms) => showToast(msg, '#ef4444', ms), [showToast]);
  const showInfo    = useCallback((msg, ms) => showToast(msg, '#3b82f6', ms), [showToast]);

  const showConfirm = useCallback(({ title, message, confirmLabel, onConfirm }) => {
    setConfirm({ title, message, confirmLabel: confirmLabel ?? t('btn_delete'), onConfirm });
  }, [t]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo, showConfirm }}>
      {children}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: toast.color, color: 'white',
          padding: '16px 28px', borderRadius: 12,
          fontSize: 15, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          zIndex: 9999, pointerEvents: 'none',
          textAlign: 'center', maxWidth: '80vw',
          animation: 'fadeInScale 0.18s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div
          onClick={() => setConfirm(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9998,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: 14,
              padding: '28px 32px',
              minWidth: 320, maxWidth: '90vw',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              animation: 'fadeInScaleModal 0.18s ease',
            }}
          >
            {confirm.title && (
              <div style={{ fontSize: 17, fontWeight: 700, color: '#f3f4f6', marginBottom: 10 }}>
                {confirm.title}
              </div>
            )}
            {confirm.message && (
              <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24, lineHeight: 1.5 }}>
                {confirm.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirm(null)}
                style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #374151', background: '#374151', color: '#d1d5db', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => { confirm.onConfirm(); setConfirm(null); }}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#ef4444', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
