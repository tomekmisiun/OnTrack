"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MemberToggles } from "@/components/MemberToggles";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { NAV_ICONS, OntrackLogo } from "@/components/layout/nav-icons";
import { APP_NAV_ITEMS, HOME_PATH } from "@/lib/config/routes";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const { logout } = useAuth();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60">
      <button
        type="button"
        onClick={() => router.push(HOME_PATH)}
        className="flex cursor-pointer items-center gap-3 border-b border-slate-800 px-4 py-5 text-left"
      >
        <OntrackLogo className="h-8 w-8 text-teal-400" />
        <div>
          <div className="text-sm font-bold tracking-wide text-slate-100">
            ONTRACK
          </div>
          <div className="text-[9px] tracking-[0.18em] text-teal-500">
            BE IN CONTROL
          </div>
        </div>
      </button>

      <div className="border-b border-slate-800 px-4 py-3">
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {String(t("include_label"))}
        </span>
        <MemberToggles variant="sidebar" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {APP_NAV_ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-teal-600/20 text-teal-300"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <span className="w-4 text-center text-xs opacity-80" aria-hidden>
                {NAV_ICONS[item.id]}
              </span>
              {String(t(item.labelKey))}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          type="button"
          onClick={() => logout()}
          className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-red-300"
        >
          {String(t("logout"))}
        </button>
      </div>
    </aside>
  );
}
