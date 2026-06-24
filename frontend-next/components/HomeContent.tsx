"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { HealthStatus } from "@/components/HealthStatus";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ProviderDemo } from "@/components/ProviderDemo";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBaseUrl } from "@/lib/config/env";

export function HomeContent() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const apiUrl = getApiBaseUrl();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        …
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-teal-500">
            OnTrack · frontend-next
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">
            Signed in
          </h1>
          <p className="mt-3 text-slate-400">
            {user.username ?? user.email ?? `user #${user.id}`} · lang{" "}
            <code className="text-slate-300">{user.lang}</code> · API{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-slate-200">
              {apiUrl}
            </code>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={logout}
            className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-red-300"
          >
            Logout
          </button>
        </div>
      </header>

      <HealthStatus />
      <ProviderDemo />

      <footer className="mt-auto border-t border-slate-800 pt-6 text-xs text-slate-500">
        Migration task 5 — auth shell. Full routing in task 6.{" "}
        <Link href="/login" className="text-teal-500 hover:underline">
          /login
        </Link>
      </footer>
    </div>
  );
}
