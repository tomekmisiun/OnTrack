"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";

export function ProviderDemo() {
  const { t } = useLanguage();
  const { showSuccess, showError, showInfo, showConfirm } = useToast();

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <h2 className="mb-3 font-semibold text-teal-400">Providers</h2>
      <p className="mb-4 text-sm text-slate-400">
        {String(t("welcome_subtitle"))}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => showSuccess(String(t("schedule_saved")))}
          className="cursor-pointer rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Toast success
        </button>
        <button
          type="button"
          onClick={() => showError(String(t("schedule_save_err")))}
          className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Toast error
        </button>
        <button
          type="button"
          onClick={() => showInfo(String(t("loading")))}
          className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Toast info
        </button>
        <button
          type="button"
          onClick={() =>
            showConfirm({
              title: String(t("delete_account")),
              message: String(t("delete_confirm")),
              onConfirm: () => showSuccess("OK"),
            })
          }
          className="cursor-pointer rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200"
        >
          Confirm modal
        </button>
      </div>
    </section>
  );
}
