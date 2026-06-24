"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { LangCode } from "@/lib/i18n/translations";

const LANGS: { code: LangCode; label: string }[] = [
  { code: "pl", label: "PL" },
  { code: "en", label: "EN" },
];

export function LanguageSwitcher() {
  const { lang, switchLang } = useLanguage();

  return (
    <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800/60 p-1">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => switchLang(code)}
          className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
            lang === code
              ? "bg-teal-600 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
          aria-pressed={lang === code}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
