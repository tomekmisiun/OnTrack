"use client";

import { useEffect } from "react";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tString } from "@/lib/i18n/translate";

type TFn = (key: TranslationKey) => unknown;

type HelpSection = {
  title: string;
  items: string[];
  macroLegend?: string;
};

function calendarHelpSections(t: TFn): HelpSection[] {
  const slot = (key: TranslationKey) => String(t(key));
  return [
    {
      title: slot("ht_meals_title"),
      items: [slot("ht_meals_1"), slot("ht_meals_2"), slot("ht_meals_3")],
    },
    {
      title: slot("ht_copy_title"),
      items: [
        slot("ht_copy_1"),
        slot("ht_copy_2"),
        slot("ht_copy_3"),
        slot("ht_copy_4"),
      ],
    },
    {
      title: slot("ht_tpl_title"),
      items: [
        slot("ht_tpl_1"),
        slot("ht_tpl_2"),
        slot("ht_tpl_3"),
        slot("ht_tpl_4"),
      ],
    },
    {
      title: slot("ht_macro_title"),
      items: [slot("ht_macro_1"), slot("ht_macro_2")],
      macroLegend: slot("ht_macro_3"),
    },
  ];
}

type CalendarHelpModalProps = {
  open: boolean;
  onClose: () => void;
  t: TFn;
};

export function CalendarHelpModal({ open, onClose, t }: CalendarHelpModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sections = calendarHelpSections(t);

  return (
    <div className="calendar-help-modal-backdrop" onClick={onClose}>
      <div
        className="calendar-help-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-help-title"
      >
        <div className="calendar-help-modal-header">
          <h2 id="calendar-help-title" className="calendar-help-modal-title">
            {tString(t, "how_to_title")}
          </h2>
          <button
            type="button"
            className="calendar-help-modal-close"
            onClick={onClose}
            aria-label={tString(t, "cancel")}
          >
            ×
          </button>
        </div>
        <div className="calendar-help-modal-body dark-scroll">
          <div className="calendar-help-grid">
            {sections.slice(0, 3).map(({ title, items }) => (
              <section key={title} className="calendar-help-section">
                <h3 className="calendar-help-section-title">{title.trim()}</h3>
                <ul className="calendar-help-list">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {sections.slice(3).map(({ title, items, macroLegend }) => (
            <section
              key={title}
              className="calendar-help-section calendar-help-section--wide"
            >
              <h3 className="calendar-help-section-title">{title.trim()}</h3>
              <ul className="calendar-help-list">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                {macroLegend && (
                  <li>
                    {macroLegend.split("·").map((part, i, arr) => {
                      const colors = ["#22c55e", "#eab308", "#ef4444"];
                      return (
                        <span key={part}>
                          <span style={{ color: colors[i], fontWeight: 600 }}>
                            {part.trim()}
                          </span>
                          {i < arr.length - 1 && (
                            <span style={{ color: "#6b7280" }}> · </span>
                          )}
                        </span>
                      );
                    })}
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
