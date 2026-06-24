"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { tFormatArgs } from "@/lib/i18n/translate";

type AppFooterProps = {
  className?: string;
};

export function AppFooter({ className = "" }: AppFooterProps) {
  const { t } = useLanguage();
  const year = new Date().getFullYear();
  const text = tFormatArgs(t, "login_copyright", year);

  return (
    <footer className={`app-site-footer${className ? ` ${className}` : ""}`}>
      {text}
    </footer>
  );
}
