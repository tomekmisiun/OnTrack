"use client";

import { useEffect } from "react";
import type { LangCode } from "@/lib/i18n/translations";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tFormatN, tString } from "@/lib/i18n/translate";
import "./products.css";

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
      <div className="products-help-options">
        <div>
          <div className="products-help-option-title">
            {tString(t, "opt1_title")}
          </div>
          <ol className="products-help-steps">
            <li>{tString(t, "opt1_s1")}</li>
            <li>
              {tString(t, "opt1_s2_pre")}{" "}
              <span className="products-help-badge">
                {tString(t, "apply_ai_label")}
              </span>{" "}
              -{" "}
              <a
                href="https://gemini.google.com/app"
                target="_blank"
                rel="noreferrer"
              >
                Gemini
              </a>{" "}
              {tString(t, "opt1_s2_suf")}
            </li>
            <li>
              {tString(t, "opt1_s3_pre")}{" "}
              <span className="products-help-badge">
                {tString(t, "apply_changes_label")}
              </span>
            </li>
          </ol>
          <div className="products-help-limit">
            {tString(t, "ai_daily_lim")}
            {remainingImports !== null && (
              <span>{tFormatN(t, "ai_rem", remainingImports)}</span>
            )}
          </div>
          <div className="products-help-note">{tString(t, "lost_receipt_hint")}</div>
        </div>
        <div>
          <div className="products-help-option-title">
            {tString(t, "opt2_title")}
          </div>
          <ol className="products-help-steps">
            <li>
              {tString(t, "opt2_required_fmt")}{" "}
              <code>{tString(t, "csv_format_full")}</code>
              <br />
              {tString(t, "opt2_or")}{" "}
              <code>{tString(t, "csv_format_short")}</code>{" "}
              <span style={{ color: "#6b7280", fontSize: 11 }}>
                ({tString(t, "opt2_manually")})
              </span>
            </li>
            <li>
              {tString(t, "opt2_upload_pre")}{" "}
              <span className="products-help-badge">
                {tString(t, "apply_file_label")}
              </span>
            </li>
          </ol>
          <div className="products-help-free">{tString(t, "no_lim")}</div>
        </div>
      </div>

      <div className="products-prompt-box">
        <div className="products-prompt-intro">
          {tString(t, "quick_update_hint")}
        </div>
        <div className="products-prompt-intro">
          <strong>1.</strong> {tString(t, "go_to_ai_pre")}{" "}
          <a href="https://claude.ai/" target="_blank" rel="noreferrer">
            Claude
          </a>
          {" / "}
          <a
            href="https://gemini.google.com/app"
            target="_blank"
            rel="noreferrer"
          >
            Gemini
          </a>
          {" / "}
          <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">
            ChatGPT
          </a>{" "}
          {tString(t, "go_to_ai_suf")}
        </div>
        <div className="products-prompt-scroll">
          <pre className="products-prompt-pre">
            {tString(t, "products_prompt")}
          </pre>
          <button
            type="button"
            className={`products-prompt-copy${promptCopied ? " products-prompt-copy--done" : ""}`}
            onClick={onCopyPrompt}
          >
            {promptCopied
              ? tString(t, "btn_copied")
              : tString(t, "copy_prompt_btn")}
          </button>
        </div>
        <div className="products-prompt-step">
          <strong>2.</strong> {tString(t, "paste_products_step")}
        </div>
        <div className="products-prompt-step">
          <strong>3.</strong> {tString(t, "create_doc_step")}
        </div>
        <div className="products-prompt-step">
          <strong>4.</strong> {tString(t, "copy_response_step")}
        </div>
        <div className="products-prompt-step">
          <strong>5.</strong> {tString(t, "save_doc_step_pre")}{" "}
          <code>{lang === "en" ? "yourname.txt" : "twojanazwa.txt"}</code>
        </div>
        <div className="products-prompt-step">
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
    <div className="products-import-modal-backdrop" onClick={onClose}>
      <div
        className="products-import-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-help-title"
      >
        <div className="products-import-modal-header">
          <h2 id="import-help-title" className="products-import-modal-title">
            {tString(t, "import_how_to")}
          </h2>
          <button
            type="button"
            className="products-import-modal-close"
            onClick={onClose}
            aria-label={tString(t, "cancel")}
          >
            ×
          </button>
        </div>
        <div className="products-import-modal-body dark-scroll">
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
