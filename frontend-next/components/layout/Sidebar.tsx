"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { MemberToggles } from "@/components/MemberToggles";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { OntrackLogo, TAB_ICONS } from "@/components/layout/nav-icons";
import { APP_NAV_ITEMS, HOME_PATH } from "@/lib/config/routes";
import "@/styles/sidebar.css";

type SidebarProps = {
  onAccount?: () => void;
};

export function Sidebar({ onAccount }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const { logout } = useAuth();

  return (
    <aside className="app-sidebar">
      <button
        type="button"
        className="sidebar-logo sidebar-logo--clickable"
        onClick={() => router.push(HOME_PATH)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push(HOME_PATH);
          }
        }}
      >
        <OntrackLogo className="sidebar-logo-icon" />
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-name">ONTRACK</span>
          <span className="sidebar-logo-sub">BE IN CONTROL</span>
        </div>
      </button>

      <div className="sidebar-profile">
        <span className="sidebar-profile-label">{String(t("include_label"))}</span>
        <MemberToggles variant="sidebar" />
      </div>

      <nav className="sidebar-nav">
        {APP_NAV_ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.id}
              href={item.path}
              data-tour={`tab-${item.id}`}
              className={`sidebar-tab${active ? " active" : ""}`}
            >
              <Icon icon={TAB_ICONS[item.id]} className="sidebar-tab-icon" />
              {String(t(item.labelKey))}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-btn sidebar-btn-account"
          onClick={onAccount}
        >
          <span className="sidebar-btn-icon" aria-hidden="true">
            <Icon icon="heroicons:cog-6-tooth" width={18} />
          </span>
          {String(t("account"))}
        </button>
        <button
          type="button"
          className="sidebar-btn sidebar-btn-logout"
          onClick={() => logout()}
        >
          <span className="sidebar-btn-icon sidebar-btn-icon--logout" aria-hidden="true">
            <Icon icon="heroicons:arrow-left-start-on-rectangle" width={18} />
          </span>
          {String(t("logout"))}
        </button>
      </div>
    </aside>
  );
}
