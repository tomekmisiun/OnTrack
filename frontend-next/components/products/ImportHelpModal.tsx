"use client";

import { useEffect } from "react";
import type { LangCode } from "@/lib/i18n/translations";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tFormatN, tString } from "@/lib/i18n/translate";

type TFn = (key: TranslationKey) => unknown;

type ImportHelpContentProps = {
  t: TFn;
  lang: LangCode;
  remainingImports: number | null;
  promptCopied: boolean;
  onCopyPrompt: () => void;
};

function ImportHelpContent({
  t,
  lang,
  remainingImports,
  promptCopied,
  onCopyPrompt,
}: ImportHelpContentProps) {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-200">
            {tString(t, "opt1_title")}
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-400">
            <li>{tString(t, "opt1_s1")}</li>
            <li>
              {tString(t, "opt1_s2_pre")}{" "}
              <span className="rounded bg-teal-900/50 px-1.5 py-0.5 text-xs font-semibold text-teal-400">
                {tString(t, "apply_ai_label")}
              </span>{" "}
              -{" "}
              <a
                href="https://gemini.google.com/app"
                target="_blank"
                rel="noreferrer"
                className="text-teal-400 hover:underline"
              >
                Gemini
              </a>{" "}
              {tString(t, "opt1_s2_suf")}
            </li>
            <li>
              {tString(t, "opt1_s3_pre")}{" "}
              <span className="rounded bg-teal-900/50 px-1.5 py-0.5 text-xs font-semibold text-teal-400">
                {tString(t, "apply_changes_label")}
              </span>
            </li>
          </ol>
          <div className="mt-3 text-xs text-slate-500">
            {tString(t, "ai_daily_lim")}
            {remainingImports !== null && (
              <span>{tFormatN(t, "ai_rem", remainingImports)}</span>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {tString(t, "lost_receipt_hint")}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-200">
            {tString(t, "opt2_title")}
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-400">
            <li>
              {tString(t, "opt2_required_fmt")}{" "}
              <code className="rounded bg-slate-900 px-1 text-xs">
                {tString(t, "csv_format_full")}
              </code>
              <br />
              {tString(t, "opt2_or")}{" "}
              <code className="rounded bg-slate-900 px-1 text-xs">
                {tString(t, "csv_format_short")}
              </code>{" "}
              <span className="text-[11px] text-slate-500">
                ({tString(t, "opt2_manually")})
              </span>
            </li>
            <li>
              {tString(t, "opt2_upload_pre")}{" "}
              <span className="rounded bg-teal-900/50 px-1.5 py-0.5 text-xs font-semibold text-teal-400">
                {tString(t, "apply_file_label")}
              </span>
            </li>
          </ol>
          <div className="mt-3 text-xs font-medium text-teal-500">
            {tString(t, "no_lim")}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <div className="mb-2 text-sm text-slate-400">
          {tString(t, "quick_update_hint")}
        </div>
        <div className="mb-3 text-sm text-slate-400">
          <strong>1.</strong> {tString(t, "go_to_ai_pre")}{" "}
          <a
            href="https://claude.ai/"
            target="_blank"
            rel="noreferrer"
            className="text-teal-400 hover:underline"
          >
            Claude
          </a>
          {" / "}
          <a
            href="https://gemini.google.com/app"
            target="_blank"
            rel="noreferrer"
            className="text-teal-400 hover:underline"
          >
            Gemini
          </a>
          {" / "}
          <a
            href="https://chatgpt.com/"
            target="_blank"
            rel="noreferrer"
            className="text-teal-400 hover:underline"
          >
            ChatGPT
          </a>{" "}
          {tString(t, "go_to_ai_suf")}
        </div>
        <div className="relative">
          <pre className="max-h-48 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
            {tString(t, "products_prompt")}
          </pre>
          <button
            type="button"
            className={`absolute right-2 top-2 cursor-pointer rounded-md px-2 py-1 text-xs font-semibold ${
              promptCopied
                ? "bg-teal-700 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
            onClick={onCopyPrompt}
          >
            {promptCopied ? tString(t, "btn_copied") : tString(t, "copy_prompt_btn")}
          </button>
        </div>
        <div className="mt-3 text-sm text-slate-400">
          <strong>2.</strong> {tString(t, "paste_products_step")}
        </div>
        <div className="mt-1 text-sm text-slate-400">
          <strong>3.</strong> {tString(t, "create_doc_step")}
        </div>
        <div className="mt-1 text-sm text-slate-400">
          <strong>4.</strong> {tString(t, "copy_response_step")}
        </div>
        <div className="mt-1 text-sm text-slate-400">
          <strong>5.</strong> {tString(t, "save_doc_step_pre")}{" "}
          <code>{lang === "en" ? "yourname.txt" : "twojanazwa.txt"}</code>
        </div>
        <div className="mt-1 text-sm text-slate-400">
          <strong>6.</strong> {tString(t, "drag_doc_step")}{" "}
          <strong>{tString(t, "click_drag_file")}</strong>
        </div>
      </div>
    </>
  );
}

type ImportHelpModalProps = {
  open: boolean;
  onClose: () => void;
  t: TFn;
  lang: LangCode;
  remainingImports: number | null;
  promptCopied: boolean;
  onCopyPrompt: () => void;
};

export function ImportHelpModal({
  open,
  onClose,
  t,
  lang,
  remainingImports,
  promptCopied,
  onCopyPrompt,
}: ImportHelpModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-help-title"
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h2
            id="import-help-title"
            className="text-lg font-bold text-slate-100"
          >
            {tString(t, "import_how_to")}
          </h2>
          <button
            type="button"
            className="cursor-pointer text-2xl leading-none text-slate-400 hover:text-slate-200"
            onClick={onClose}
            aria-label={tString(t, "cancel")}
          >
            ×
          </button>
        </div>
        <div className="max-h-[calc(90vh-4rem)] overflow-y-auto px-5 py-4">
          <ImportHelpContent
            t={t}
            lang={lang}
            remainingImports={remainingImports}
            promptCopied={promptCopied}
            onCopyPrompt={onCopyPrompt}
          />
        </div>
      </div>
    </div>
  );
}
