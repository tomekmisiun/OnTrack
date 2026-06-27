"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMember } from "@/contexts/MemberContext";
import { useToast } from "@/contexts/ToastContext";
import { getSummary, type MealPlanSummary } from "@/lib/api/mealPlan";
import { listProducts } from "@/lib/api/products";
import { listRecipes } from "@/lib/api/recipes";
import { getCurrentMonth, getCurrentWeek } from "@/lib/dates";
import type { ExpenseLineItem } from "@/lib/summary/expenseItems";
import type { Product } from "@/types/product";
import type { RecipeSummary } from "@/types/recipe";
import type { WeekTemplate } from "@/types/mealPlan";
import type { PieSlice } from "@/components/summary/SummaryPieChart";
import { tFormatN, tString } from "@/lib/i18n/translate";

const WEEK_TEMPLATES_KEY = "weekTemplates";

function loadTemplates(): WeekTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(WEEK_TEMPLATES_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WeekTemplate =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as WeekTemplate).name === "string" &&
        Array.isArray((item as WeekTemplate).meals),
    );
  } catch {
    return [];
  }
}

export type SummaryPeriod = "month" | "week" | "custom";

export function useSummaryPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showError } = useToast();
  const { targetMemberIds } = useMember();

  const week = getCurrentWeek();
  const month = getCurrentMonth();

  const [weekSummary, setWeekSummary] = useState<MealPlanSummary | null>(null);
  const [monthSummary, setMonthSummary] = useState<MealPlanSummary | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [activePeriod, setActivePeriod] = useState<SummaryPeriod>("month");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [customSummary, setCustomSummary] = useState<MealPlanSummary | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [templates, setTemplates] = useState<WeekTemplate[]>([]);
  const [expandedTpl, setExpandedTpl] = useState<number | null>(null);
  const [recipeList, setRecipeList] = useState<RecipeSummary[]>([]);
  const [productList, setProductList] = useState<Product[]>([]);
  const [drinkItems, setDrinkItems] = useState<ExpenseLineItem[]>([]);
  const [pieCategories, setPieCategories] = useState<PieSlice[]>([]);
  const [productsOpenCustom, setProductsOpenCustom] = useState(false);

  const loadMidsKey = targetMemberIds.join(",");

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  useEffect(() => {
    if (!targetMemberIds.length) return;
    setWeekLoading(true);
    setMonthLoading(true);
    Promise.all([
      getSummary(week.start, week.end, targetMemberIds),
      getSummary(month.start, month.end, targetMemberIds),
      listRecipes(),
      listProducts({ limit: 100 }),
    ])
      .then(([wRes, mRes, recipes, productsPage]) => {
        setWeekSummary(wRes);
        setMonthSummary(mRes);
        setRecipeList(recipes);
        setProductList(productsPage.items);
      })
      .catch(() => showError(tString(t, "err_load_summary")))
      .finally(() => {
        setWeekLoading(false);
        setMonthLoading(false);
      });
  }, [loadMidsKey, week.start, week.end, month.start, month.end, user?.market_code, user?.ui_locale, showError, t, targetMemberIds]);

  const drinksDays = useMemo(() => {
    if (activePeriod === "week") return 7;
    if (activePeriod === "month") return 30;
    if (
      activePeriod === "custom" &&
      customRange.start &&
      customRange.end &&
      customRange.end >= customRange.start
    ) {
      return Math.max(
        1,
        Math.round(
          (new Date(customRange.end).getTime() - new Date(customRange.start).getTime()) /
            86400000,
        ) + 1,
      );
    }
    return 7;
  }, [activePeriod, customRange]);

  const drinksPeriodLabel =
    activePeriod === "week"
      ? tString(t, "drinks_period_week")
      : activePeriod === "month"
        ? tFormatN(t, "drinks_period_month", drinksDays)
        : tFormatN(t, "drinks_period_custom", drinksDays);

  const handleCustomLoad = useCallback(async () => {
    if (!customRange.start || !customRange.end) {
      showError(tString(t, "err_select_range"));
      return;
    }
    if (customRange.start > customRange.end) {
      showError(tString(t, "err_date_order"));
      return;
    }
    setCustomLoading(true);
    try {
      const res = await getSummary(customRange.start, customRange.end, targetMemberIds);
      setCustomSummary(res);
    } catch {
      showError(tString(t, "err_load_summary"));
    } finally {
      setCustomLoading(false);
    }
  }, [customRange, showError, t, targetMemberIds]);

  const deleteTemplate = useCallback((idx: number) => {
    setTemplates((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      localStorage.setItem(WEEK_TEMPLATES_KEY, JSON.stringify(updated));
      return updated;
    });
    setExpandedTpl((cur) => (cur === idx ? null : cur));
  }, []);

  const goToTab = useCallback(
    (tab: string) => {
      router.push(`/${tab}`);
    },
    [router],
  );

  const tplData = useMemo(
    () =>
      templates.map((tpl) => {
        let cost = 0;
        let kcal = 0;
        tpl.meals.forEach((m) => {
          const r = recipeList.find((row) => row.id === m.recipe_id);
          if (r) {
            cost += r.total_cost || 0;
            kcal += r.total_kcal || 0;
          }
        });
        return { ...tpl, estimatedCost: cost, estimatedKcal: Math.round(kcal) };
      }),
    [templates, recipeList],
  );

  return {
    week,
    month,
    weekSummary,
    monthSummary,
    weekLoading,
    monthLoading,
    activePeriod,
    setActivePeriod,
    customRange,
    setCustomRange,
    customSummary,
    customLoading,
    handleCustomLoad,
    templates,
    expandedTpl,
    setExpandedTpl,
    deleteTemplate,
    recipeList,
    productList,
    drinkItems,
    setDrinkItems,
    pieCategories,
    setPieCategories,
    productsOpenCustom,
    setProductsOpenCustom,
    drinksDays,
    drinksPeriodLabel,
    goToTab,
    tplData,
  };
}
