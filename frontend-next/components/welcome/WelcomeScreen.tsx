"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { WelcomeMembers } from "@/components/welcome/WelcomeMembers";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWelcomeStats } from "@/hooks/useWelcomeStats";
import type { AppNavId } from "@/lib/config/routes";
import { tFormatArgs, tFormatN, tString } from "@/lib/i18n/translate";
import type { TranslationKey } from "@/lib/i18n/translations";
import "./welcome.css";

const TILES: Array<{
  id: AppNavId;
  icon: string;
  descKey: TranslationKey;
  insight?: string;
}> = [
  { id: "macro", icon: "heroicons:calculator", descKey: "welcome_tile_macro", insight: "macro" },
  { id: "calendar", icon: "heroicons:calendar-days", descKey: "welcome_tile_calendar", insight: "meals" },
  { id: "schedule", icon: "heroicons:clock", descKey: "welcome_tile_schedule", insight: "schedule" },
  { id: "recipes", icon: "heroicons:book-open", descKey: "welcome_tile_recipes", insight: "recipes" },
  { id: "products", icon: "heroicons:shopping-cart", descKey: "welcome_tile_products", insight: "products" },
  { id: "summary", icon: "heroicons:banknotes", descKey: "welcome_tile_summary", insight: "expenses" },
  { id: "export", icon: "heroicons:arrow-down-tray", descKey: "welcome_tile_export" },
];

const TAB_LABEL_KEYS: Record<AppNavId, TranslationKey> = {
  macro: "tab_macro",
  calendar: "tab_calendar",
  schedule: "tab_schedule",
  recipes: "tab_recipes",
  products: "tab_products",
  summary: "tab_summary",
  export: "tab_export",
};

type WelcomeStats = ReturnType<typeof useWelcomeStats>["stats"];

function countLabel(
  t: ReturnType<typeof useLanguage>["t"],
  oneKey: TranslationKey,
  manyKey: TranslationKey,
  n: number,
) {
  if (n === 1) return tString(t, oneKey);
  return tFormatN(t, manyKey, n);
}

function getInsight(
  insightType: string | undefined,
  stats: WelcomeStats,
  loading: boolean,
  t: ReturnType<typeof useLanguage>["t"],
) {
  if (!insightType) return null;
  if (loading) {
    return { text: tString(t, "welcome_insight_loading"), tone: "muted" as const };
  }

  switch (insightType) {
    case "macro": {
      const lines = stats.macroInsights || [];
      if (!lines.length) {
        return { text: tString(t, "welcome_insight_macro_none"), tone: "empty" as const };
      }
      if (lines.length === 1) {
        const label = lines[0]?.label;
        if (label) return { text: label, tone: "active" as const };
        return { text: tString(t, "welcome_insight_macro_none"), tone: "empty" as const };
      }
      const text = lines
        .map(({ name, label }) =>
          tFormatArgs(t, "welcome_insight_macro_member", name, label ?? ""),
        )
        .join(", ");
      const anyGoal = lines.some((line) => line.label);
      return { text, tone: anyGoal ? ("active" as const) : ("empty" as const), wide: true };
    }
    case "meals":
      if ((stats.mealsToday ?? 0) > 0) {
        return {
          text: countLabel(
            t,
            "welcome_insight_meals_one",
            "welcome_insight_meals_many",
            stats.mealsToday ?? 0,
          ),
          tone: "active" as const,
        };
      }
      return { text: tString(t, "welcome_insight_meals_none"), tone: "empty" as const };
    case "schedule": {
      const lines = stats.scheduleInsights || [];
      if (!lines.length) {
        return { text: tString(t, "welcome_insight_schedule_none"), tone: "empty" as const };
      }
      if (lines.length === 1) {
        const count = lines[0]?.count ?? 0;
        if (count > 0) {
          return {
            text: countLabel(
              t,
              "welcome_insight_schedule_one",
              "welcome_insight_schedule_many",
              count,
            ),
            tone: "active" as const,
          };
        }
        return { text: tString(t, "welcome_insight_schedule_none"), tone: "empty" as const };
      }
      const text = lines
        .map(({ name, count }) =>
          tFormatArgs(t, "welcome_insight_schedule_member", name, count),
        )
        .join(", ");
      const total = lines.reduce((sum, line) => sum + line.count, 0);
      return {
        text,
        tone: total > 0 ? ("active" as const) : ("empty" as const),
        wide: true,
      };
    }
    case "recipes":
      if ((stats.ownRecipes ?? 0) > 0) {
        return {
          text: countLabel(
            t,
            "welcome_insight_recipes_one",
            "welcome_insight_recipes_many",
            stats.ownRecipes ?? 0,
          ),
          tone: "active" as const,
        };
      }
      return { text: tString(t, "welcome_insight_recipes_none"), tone: "empty" as const };
    case "products":
      if ((stats.ownProducts ?? 0) > 0) {
        return {
          text: countLabel(
            t,
            "welcome_insight_products_one",
            "welcome_insight_products_many",
            stats.ownProducts ?? 0,
          ),
          tone: "active" as const,
        };
      }
      return { text: tString(t, "welcome_insight_products_none"), tone: "empty" as const };
    case "expenses":
      if ((stats.monthTotalCost ?? 0) > 0) {
        return {
          text: tFormatArgs(
            t,
            "welcome_insight_expenses",
            stats.monthTotalCost ?? 0,
            tString(t, "currency"),
          ),
          tone: "active" as const,
        };
      }
      return { text: tString(t, "welcome_insight_expenses_none"), tone: "empty" as const };
    default:
      return null;
  }
}

import { useProfileModal } from "@/components/profile/ProfileModalContext";
export function WelcomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { logout } = useAuth();
  const { openProfile } = useProfileModal();
  const { stats, loading } = useWelcomeStats();

  const goToTab = (id: AppNavId) => {
    router.push(`/${id}`);
  };

  return (
    <div className="welcome-page">
      <div className="welcome">
        <div className="welcome-brand">
          <svg
            className="welcome-brand-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9.5" />
            <path
              d="M8.5 15.5 L11.8 11.8 L15.5 8.5 L12.2 12.2 Z"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          <div className="welcome-brand-text">
            <span className="welcome-brand-name">ONTRACK</span>
            <span className="welcome-brand-sub">BE IN CONTROL</span>
          </div>
        </div>

        <header className="welcome-header">
          <h1 className="welcome-title">{String(t("welcome_greeting"))}</h1>
          <p className="welcome-subtitle">{String(t("welcome_subtitle"))}</p>
        </header>

        <div className="welcome-grid">
          {TILES.map(({ id, icon, descKey, insight }) => {
            const insightData = getInsight(insight, stats, loading, t);
            return (
              <button
                key={id}
                type="button"
                className="welcome-tile-stack"
                onClick={() => goToTab(id)}
              >
                {insightData && (
                  <div
                    className={`welcome-insight welcome-insight--${insightData.tone}${insightData.wide ? " welcome-insight--wide" : ""}`}
                  >
                    {insightData.text}
                  </div>
                )}
                <div className="welcome-tile">
                  <span className="welcome-tile-icon" aria-hidden="true">
                    <Icon icon={icon} width={26} />
                  </span>
                  <span className="welcome-tile-body">
                    <span className="welcome-tile-label">
                      {String(t(TAB_LABEL_KEYS[id]))}
                    </span>
                    <span className="welcome-tile-desc">{String(t(descKey))}</span>
                  </span>
                  <Icon
                    icon="heroicons:chevron-right"
                    className="welcome-tile-arrow"
                    width={18}
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>

        <WelcomeMembers />

        <footer className="welcome-footer">
          <button
            type="button"
            className="welcome-footer-btn welcome-footer-btn--account"
            onClick={openProfile}
          >
            <Icon icon="heroicons:cog-6-tooth" width={18} />
            {String(t("account"))}
          </button>
          <button
            type="button"
            className="welcome-footer-btn welcome-footer-btn--logout"
            onClick={() => logout()}
          >
            <Icon icon="heroicons:arrow-left-start-on-rectangle" width={18} />
            {String(t("logout"))}
          </button>
        </footer>
      </div>
    </div>
  );
}
