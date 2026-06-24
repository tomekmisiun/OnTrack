"use client";

import { Fragment, useEffect } from "react";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tString } from "@/lib/i18n/translate";
import { PROMPT_NAME_MARK } from "@/hooks/useRecipesPage";

type TFn = (key: TranslationKey) => unknown;

function renderRecipePrompt(text: string, nameLabel: string) {
  const parts = text.split(PROMPT_NAME_MARK);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <strong className="font-extrabold text-teal-400">{nameLabel}</strong>
      )}
    </Fragment>
  ));
}

type RecipeHelpModalProps = {
  open: boolean;
  onClose: () => void;
  t: TFn;
  nameLabel: string;
  promptCopied: boolean;
  onCopyPrompt: () => void;
};

export function RecipeHelpModal({
  open,
  onClose,
  t,
  nameLabel,
  promptCopied,
  onCopyPrompt,
}: RecipeHelpModalProps) {
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
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-help-title"
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h2
            id="recipe-help-title"
            className="text-lg font-bold text-slate-100"
          >
            {tString(t, "how_to_recipe")}
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
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <div className="mb-3 text-sm text-slate-400">
              {tString(t, "use_ai_hint")}{" "}
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
              </a>
              {tString(t, "use_ai_hint2")}
            </div>
            <div className="relative">
              <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-300">
                {renderRecipePrompt(tString(t, "recipe_prompt"), nameLabel)}
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
                {promptCopied
                  ? tString(t, "copied_label")
                  : tString(t, "copy_prompt_btn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
