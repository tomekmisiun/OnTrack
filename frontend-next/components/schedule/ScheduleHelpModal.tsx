"use client";

import { useEffect } from "react";
import { Icon } from "@iconify/react";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tString } from "@/lib/i18n/translate";

type TFn = (key: TranslationKey) => unknown;

type HelpItem = {
  icon: string;
  label: string;
  desc: string;
  examples?: string[];
};

function scheduleHelpItems(t: TFn): HelpItem[] {
  return [
    {
      icon: "heroicons:bolt",
      label: tString(t, "schedule_help_quick_label"),
      desc: tString(t, "schedule_help_quick"),
      examples: [
        tString(t, "schedule_help_ex_1"),
        tString(t, "schedule_help_ex_2"),
        tString(t, "schedule_help_ex_3"),
      ],
    },
    {
      icon: "heroicons:users",
      label: tString(t, "schedule_help_profiles_label"),
      desc: tString(t, "schedule_help_profiles"),
    },
    {
      icon: "heroicons:cursor-arrow-rays",
      label: tString(t, "schedule_help_drag_label"),
      desc: tString(t, "schedule_help_drag"),
    },
    {
      icon: "heroicons:pencil-square",
      label: tString(t, "schedule_help_edit_label"),
      desc: tString(t, "schedule_help_edit"),
    },
  ];
}

type ScheduleHelpModalProps = {
  open: boolean;
  onClose: () => void;
  t: TFn;
};

export function ScheduleHelpModal({ open, onClose, t }: ScheduleHelpModalProps) {
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
    <div className="schedule-help-modal-backdrop" onClick={onClose}>
      <div
        className="schedule-help-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-help-title"
      >
        <div className="schedule-help-modal-header">
          <h2 id="schedule-help-title" className="schedule-help-modal-title">
            {tString(t, "schedule_how_title")}
          </h2>
          <button
            type="button"
            className="schedule-help-modal-close"
            onClick={onClose}
            aria-label={tString(t, "cancel")}
          >
            ×
          </button>
        </div>
        <div className="schedule-help-modal-body dark-scroll">
          <div className="schedule-help-list">
            {scheduleHelpItems(t).map(({ icon, label, desc, examples }) => (
              <article key={label} className="schedule-help-card">
                <div className="schedule-help-card-icon" aria-hidden="true">
                  <Icon icon={icon} width={20} />
                </div>
                <div className="schedule-help-card-body">
                  <h3 className="schedule-help-card-title">{label}</h3>
                  <p className="schedule-help-card-desc">{desc}</p>
                  {examples && examples.length > 0 && (
                    <div className="schedule-help-examples">
                      {examples.map((ex) => (
                        <code key={ex} className="schedule-help-example">
                          {ex}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
