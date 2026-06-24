"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MemberToggles } from "@/components/MemberToggles";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { APP_NAV_ITEMS } from "@/lib/config/routes";

export function HomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-teal-500">
            OnTrack
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">
            {String(t("welcome_greeting"))}
          </h1>
          <p className="mt-3 text-slate-400">
            {String(t("welcome_subtitle"))}
          </p>
          {user && (
            <p className="mt-2 text-sm text-slate-500">
              {user.username ?? user.email ?? `user #${user.id}`}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => logout()}
            className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-red-300"
          >
            {String(t("logout"))}
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <p className="mb-3 text-sm font-medium text-slate-300">
          {String(t("welcome_include_members"))}
        </p>
        <MemberToggles variant="welcome" />
        <p className="mt-2 text-xs text-slate-500">
          {String(t("welcome_members_hint"))}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {APP_NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.path}
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-4 transition-colors hover:border-teal-600/50 hover:bg-slate-800"
          >
            <div className="font-semibold text-slate-100">
              {String(t(item.labelKey))}
            </div>
            <div className="mt-1 text-xs text-slate-500">{item.path}</div>
          </Link>
        ))}
      </section>

      <footer className="mt-auto border-t border-slate-800 pt-6 text-xs text-slate-500">
        Migration task 7 — members module.{" "}
        <button
          type="button"
          onClick={() => router.push("/macro")}
          className="cursor-pointer text-teal-500 hover:underline"
        >
          /macro
        </button>
      </footer>
    </div>
  );
}
