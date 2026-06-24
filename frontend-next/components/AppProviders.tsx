"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { ToastProvider } from "@/contexts/ToastContext";

function AuthWithLanguage({ children }: { children: ReactNode }) {
  const { switchLang } = useLanguage();
  return <AuthProvider onLangChange={switchLang}>{children}</AuthProvider>;
}

/** Global client providers — mirrors CRA App.js provider order. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthWithLanguage>{children}</AuthWithLanguage>
      </ToastProvider>
    </LanguageProvider>
  );
}
