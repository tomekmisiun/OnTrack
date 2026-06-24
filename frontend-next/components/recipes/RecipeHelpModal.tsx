"use client";

import { Fragment, useEffect } from "react";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tString } from "@/lib/i18n/translate";
import { PROMPT_NAME_MARK } from "@/hooks/useRecipesPage";
import "./recipes.css";

type TFn = (key: TranslationKey) => unknown;

function renderRecipePrompt(text: string, nameLabel: string) {
  const parts = text.split(PROMPT_NAME_MARK);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <strong style={{ color: "#2dd4bf", fontWeight: 800 }}>{nameLabel}</strong>
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
    <div className="recipes-help-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="recipes-help-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-help-title"
      >
        <div className="recipes-help-modal-header">
          <h2 id="recipe-help-title" className="recipes-help-modal-title">
            {tString(t, "how_to_recipe")}
          </h2>
          <button
            type="button"
            className="recipes-help-modal-close"
            onClick={onClose}
            aria-label={tString(t, "cancel")}
          >
            ×
          </button>
        </div>
        <div className="recipes-help-modal-body dark-scroll">
          <div className="recipes-prompt-box">
            <div className="recipes-prompt-intro">
              {tString(t, "use_ai_hint")}{" "}
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
              </a>
              {tString(t, "use_ai_hint2")}
            </div>
            <div className="recipes-prompt-scroll">
              <pre className="recipes-prompt-pre">
                {renderRecipePrompt(tString(t, "recipe_prompt"), nameLabel)}
              </pre>
              <button
                type="button"
                className={`recipes-prompt-copy${promptCopied ? " recipes-prompt-copy--done" : ""}`}
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
