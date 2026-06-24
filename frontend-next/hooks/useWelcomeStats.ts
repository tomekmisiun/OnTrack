"use client";

import { useEffect, useState } from "react";
import { getAll } from "@/lib/api/daySchedule";
import { getDay, getSummary } from "@/lib/api/mealPlan";
import { listProducts } from "@/lib/api/products";
import { listRecipes } from "@/lib/api/recipes";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMember } from "@/contexts/MemberContext";
import { SEED_STATS } from "@/lib/data/seedStats";
import { dateToStr, getCurrentMonth, getCurrentWeek } from "@/lib/dates";
import {
  SUMMARY_MONTH_DAYS,
  sumEnabledExpenses,
} from "@/lib/summary/expenseItems";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tString } from "@/lib/i18n/translate";

const GOAL_I18N: Record<string, TranslationKey> = {
  lose: "macro_cut",
  maintain: "macro_maintain",
  extreme: "macro_aggr_cut",
  gain: "macro_bulk",
};

type MacroInsight = { id: number; name: string; label: string | null };
type ScheduleInsight = { id: number; name: string; count: number };

type WelcomeStats = {
  macroInsights: MacroInsight[];
  mealsToday: number | null;
  scheduleInsights: ScheduleInsight[];
  ownRecipes: number | null;
  ownProducts: number | null;
  monthTotalCost: number | null;
};

const EMPTY: WelcomeStats = {
  macroInsights: [],
  mealsToday: null,
  scheduleInsights: [],
  ownRecipes: null,
  ownProducts: null,
  monthTotalCost: null,
};

function resolveMemberMacroLabel(
  member: { goal?: string | null; macro_goals?: { goalLabel?: string | null } | null },
  t: ReturnType<typeof useLanguage>["t"],
): string | null {
  if (!member?.macro_goals && !member?.goal) return null;
  const i18nKey = member.goal ? GOAL_I18N[member.goal] : undefined;
  if (i18nKey) return tString(t, i18nKey);
  return member.macro_goals?.goalLabel ?? member.goal ?? null;
}

export function useWelcomeStats() {
  const { user } = useAuth();
  const { activeMember, includedMemberIds, members } = useMember();
  const { lang, t } = useLanguage();
  const [stats, setStats] = useState<WelcomeStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  const includedKey = includedMemberIds.join(",");
  const activeId = activeMember?.id;

  useEffect(() => {
    if (!user?.id) {
      setStats(EMPTY);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const includedMids = includedMemberIds.length
      ? includedMemberIds
      : activeId
        ? [activeId]
        : [];
    const today = dateToStr(new Date());
    const weekStart = getCurrentWeek().start;
    const month = getCurrentMonth();
    const todayDow = (new Date().getDay() + 6) % 7;
    const seed = SEED_STATS[lang] ?? SEED_STATS.pl;

    async function load() {
      setLoading(true);
      try {
        const [mealsResults, scheduleResults, monthRes, productsRes, recipesRes] =
          await Promise.all([
            includedMids.length
              ? Promise.all(includedMids.map((id) => getDay(today, id)))
              : Promise.resolve([]),
            includedMids.length
              ? Promise.all(
                  includedMids.map((id) => getAll(id, weekStart)),
                )
              : Promise.resolve([]),
            includedMids.length
              ? getSummary(month.start, month.end, includedMids)
              : Promise.resolve({ total_cost: 0, items: [] }),
            listProducts({ limit: 100 }),
            listRecipes(),
          ]);

        if (cancelled) return;

        const productList = productsRes.items;
        const foodCost = monthRes.total_cost ?? 0;
        const enabledExtras = sumEnabledExpenses(
          SUMMARY_MONTH_DAYS,
          productList,
          includedMids.length,
        );
        const monthTotalCost = foodCost + enabledExtras;

        const mealsToday = mealsResults.reduce(
          (sum, meals) => sum + meals.length,
          0,
        );
        const scheduleInsights = includedMids.map((mid, i) => {
          const member = members.find((m) => m.id === mid);
          const blocks = scheduleResults[i] ?? [];
          return {
            id: mid,
            name: member?.name || "?",
            count: blocks.filter((b) => b.day === todayDow).length,
          };
        });

        const macroInsights = includedMids.map((mid) => {
          const member = members.find((m) => m.id === mid);
          return {
            id: mid,
            name: member?.name || "?",
            label: member ? resolveMemberMacroLabel(member, t) : null,
          };
        });

        setStats({
          macroInsights,
          mealsToday,
          scheduleInsights,
          ownProducts: Math.max(
            0,
            productList.filter((p) => p.is_editable).length - seed.products,
          ),
          ownRecipes: Math.max(0, recipesRes.length - seed.recipes),
          monthTotalCost,
        });
      } catch {
        if (!cancelled) setStats(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.market_code, members, lang, t, includedKey, activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { stats, loading };
}
