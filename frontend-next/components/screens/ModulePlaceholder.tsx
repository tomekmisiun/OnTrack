"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AppNavId } from "@/lib/config/routes";
import { APP_NAV_ITEMS } from "@/lib/config/routes";

type ModulePlaceholderProps = {
  moduleId: AppNavId;
};

export function ModulePlaceholder({ moduleId }: ModulePlaceholderProps) {
  const { t } = useLanguage();
  const item = APP_NAV_ITEMS.find((row) => row.id === moduleId);
  const title = item ? String(t(item.labelKey)) : moduleId;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-wider text-teal-500">
        OnTrack · frontend-next
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">{title}</h1>
      <p className="mt-3 text-slate-400">
        Screen migration pending — route and navigation shell are in place.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm text-teal-400 hover:underline"
      >
        ← {String(t("welcome_greeting"))}
      </Link>
    </div>
  );
}
