"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { T, type LangCode, type TranslationKey, type TranslationValue } from "@/lib/i18n/translations";

export type LanguageContextValue = {
  lang: LangCode;
  switchLang: (lang: LangCode) => void;
  t: (key: TranslationKey) => TranslationValue;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLang(): LangCode {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("lang");
  return stored === "pl" || stored === "en" ? stored : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<LangCode>(() => readStoredLang());

  const switchLang = useCallback((next: LangCode) => {
    setLang(next);
    localStorage.setItem("lang", next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey): TranslationValue => {
      const val = T[lang][key];
      if (val !== undefined) return val;
      return T.pl[key] ?? key;
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, switchLang, t }),
    [lang, switchLang, t],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
