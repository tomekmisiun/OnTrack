"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLanguage } from "@/contexts/LanguageContext";

type ToastState = {
  msg: string;
  color: string;
};

type ConfirmState = {
  title?: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export type ConfirmOptions = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

export type ToastContextValue = {
  showToast: (msg: string, color?: string, ms?: number) => void;
  showSuccess: (msg: string, ms?: number) => void;
  showError: (msg: string, ms?: number) => void;
  showInfo: (msg: string, ms?: number) => void;
  showConfirm: (options: ConfirmOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_COLORS = {
  error: "#ef4444",
  success: "#0d9488",
  info: "#3b82f6",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const showToast = useCallback((msg: string, color: string = TOAST_COLORS.error, ms = 3000) => {
    setToast({ msg, color });
    window.setTimeout(() => setToast(null), ms);
  }, []);

  const showSuccess = useCallback(
    (msg: string, ms?: number) => showToast(msg, TOAST_COLORS.success, ms),
    [showToast],
  );
  const showError = useCallback(
    (msg: string, ms?: number) => showToast(msg, TOAST_COLORS.error, ms),
    [showToast],
  );
  const showInfo = useCallback(
    (msg: string, ms?: number) => showToast(msg, TOAST_COLORS.info, ms),
    [showToast],
  );

  const showConfirm = useCallback(
    ({ title, message, confirmLabel, onConfirm }: ConfirmOptions) => {
      setConfirm({
        title,
        message,
        confirmLabel: confirmLabel ?? String(t("btn_delete")),
        onConfirm,
      });
    },
    [t],
  );

  const value = useMemo(
    () => ({ showToast, showSuccess, showError, showInfo, showConfirm }),
    [showToast, showSuccess, showError, showInfo, showConfirm],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {toast && (
        <div
          className="pointer-events-none fixed left-1/2 top-1/2 z-[9999] max-w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-xl px-7 py-4 text-center text-[15px] font-semibold text-white shadow-2xl"
          style={{ backgroundColor: toast.color }}
          role="status"
        >
          {toast.msg}
        </div>
      )}

      {confirm && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/55"
          onClick={() => setConfirm(null)}
          role="presentation"
        >
          <div
            className="min-w-[320px] max-w-[90vw] rounded-[14px] border border-slate-700 bg-slate-800 p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {confirm.title && (
              <div className="mb-2.5 text-[17px] font-bold text-slate-100">
                {confirm.title}
              </div>
            )}
            {confirm.message && (
              <div className="mb-6 text-sm leading-relaxed text-slate-400">
                {confirm.message}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="cursor-pointer rounded-md border border-slate-600 bg-slate-700 px-[18px] py-2 text-sm font-semibold text-slate-300"
              >
                {String(t("cancel"))}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirm.onConfirm();
                  setConfirm(null);
                }}
                className="cursor-pointer rounded-md border-none bg-red-500 px-[18px] py-2 text-sm font-semibold text-white"
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

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
