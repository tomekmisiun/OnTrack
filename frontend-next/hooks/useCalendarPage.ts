"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMember } from "@/contexts/MemberContext";
import { useToast } from "@/contexts/ToastContext";
import { ApiError, errorMessageFromBody } from "@/lib/api/errors";
import {
  addMeal,
  copyRange,
  deleteMeal,
  getDay,
  getRange,
} from "@/lib/api/mealPlan";
import { listRecipes, toggleFavorite } from "@/lib/api/recipes";
import {
  addDays,
  dateToStr,
  getCalGrid,
  toEU,
} from "@/lib/dates";
import {
  buildOptimisticMeal,
  clearDayInState,
  findMealDate,
  removeMealFromState,
  resolveMealIdsForAllMembers,
  upsertMealInState,
} from "@/lib/mealPlan/state";
import type {
  Meal,
  MealsByDate,
  TplSlotRecipe,
  TplSlots,
  WeekTemplate,
} from "@/types/mealPlan";
import type { MacroGoals } from "@/types/member";
import type { RecipeSummary } from "@/types/recipe";

const WEEK_TEMPLATES_KEY = "weekTemplates";

function loadTemplates(): WeekTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WEEK_TEMPLATES_KEY) ?? "[]";
    const parsed = JSON.parse(raw) as unknown;
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

export function pickRecipeMacros(recipe: {
  total_kcal?: number;
  total_protein?: number;
  total_fat?: number;
  total_carbs?: number;
  total_cost?: number;
}) {
  return {
    total_kcal: recipe.total_kcal ?? 0,
    total_protein: recipe.total_protein ?? 0,
    total_fat: recipe.total_fat ?? 0,
    total_carbs: recipe.total_carbs ?? 0,
    total_cost: recipe.total_cost ?? 0,
  };
}

export function toTplSlot(recipe: {
  id: number;
  name: string;
  total_kcal?: number;
  total_protein?: number;
  total_fat?: number;
  total_carbs?: number;
  total_cost?: number;
}): TplSlotRecipe {
  return { id: recipe.id, name: recipe.name, ...pickRecipeMacros(recipe) };
}

export function useCalendarPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showError, showSuccess, showConfirm } = useToast();
  const { activeMember, targetMemberIds } = useMember();

  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayStr = dateToStr(todayMidnight);

  const [year, setYear] = useState(todayMidnight.getFullYear());
  const [month, setMonth] = useState(todayMidnight.getMonth());
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [mealsByDate, setMealsByDate] = useState<MealsByDate>({});
  const [copiedDay, setCopiedDay] = useState<string | null>(null);
  const [copiedWeek, setCopiedWeek] = useState<string | null>(null);
  const [inlineToast, setInlineToast] = useState<{
    msg: string;
    color: string;
  } | null>(null);
  const [calendarHelpOpen, setCalendarHelpOpen] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(true);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [carouselCatFilter, setCarouselCatFilter] = useState<string | null>(
    null,
  );
  const [carouselVisible, setCarouselVisible] = useState(12);
  const [tplSlots, setTplSlots] = useState<TplSlots>({});
  const [tplOpen, setTplOpen] = useState(false);
  const [previewRecipe, setPreviewRecipe] = useState<RecipeSummary | null>(null);
  const [templates, setTemplates] = useState<WeekTemplate[]>(loadTemplates);

  const carouselScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrolledToTodayRef = useRef(false);

  const macroGoals: MacroGoals | null = activeMember?.macro_goals ?? null;

  const showInlineToast = useCallback((msg: string, color = "#0066cc") => {
    setInlineToast({ msg, color });
    setTimeout(() => setInlineToast(null), 3000);
  }, []);

  const scrollToTodayCell = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = document.getElementById("calendar-today");
    if (!el) return false;
    el.scrollIntoView({ behavior, block: "start" });
    return true;
  }, []);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      const grid = getCalGrid(y, m);
      const start = dateToStr(grid[0]!);
      const end = dateToStr(grid[grid.length - 1]!);
      const mid = activeMember?.id;
      try {
        const data = await getRange(start, end, mid ? [mid] : []);
        setMealsByDate(data);
      } catch {
        showError(String(t("err_load_plan")));
      }
    },
    [activeMember?.id, showError, t],
  );

  useEffect(() => {
    listRecipes()
      .then(setRecipes)
      .catch(() => showError(String(t("err_load_recipes"))));
  }, [user?.market_code, showError, t]);

  useEffect(() => {
    void loadMonth(year, month);
  }, [year, month, loadMonth]);

  useEffect(() => {
    if (Object.keys(tplSlots).length === 0) setCopiedWeek(null);
  }, [tplSlots]);

  useEffect(() => {
    if (year !== todayMidnight.getFullYear() || month !== todayMidnight.getMonth()) {
      return;
    }
    if (scrolledToTodayRef.current) return;
    const timer = setTimeout(() => {
      if (scrollToTodayCell()) scrolledToTodayRef.current = true;
    }, 250);
    return () => clearTimeout(timer);
  }, [year, month, mealsByDate, scrollToTodayCell, todayMidnight]);

  useEffect(() => {
    const handler = () => {
      setTplOpen(true);
      setTimeout(
        () =>
          document
            .getElementById("template-section")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100,
      );
    };
    window.addEventListener("open-template", handler);
    return () => window.removeEventListener("open-template", handler);
  }, []);

  useEffect(() => {
    if (!copiedDay && !copiedWeek) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setCopiedDay(null);
        setCopiedWeek(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [copiedDay, copiedWeek]);

  const handleToggleFavorite = useCallback(
    async (id: number) => {
      await toggleFavorite(id);
      const list = await listRecipes();
      setRecipes(list);
    },
    [],
  );

  const prevMonth = useCallback(() => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const handleDelete = useCallback(
    async (mealId: number) => {
      const date = findMealDate(mealsByDate, mealId);
      if (!date) return;
      const meal = (mealsByDate[date] ?? []).find((m) => m.id === mealId);
      if (!meal || !targetMemberIds.length) return;

      let previous: MealsByDate | undefined;
      setMealsByDate((prev) => {
        previous = prev;
        return removeMealFromState(prev, mealId, date);
      });
      try {
        const ids = await resolveMealIdsForAllMembers({
          dateStr: date,
          position: meal.position,
          memberIds: targetMemberIds,
          mealsByDate,
          viewMemberId: activeMember?.id,
          getDay,
        });
        await Promise.all(ids.map((id) => deleteMeal(id)));
      } catch {
        if (previous) setMealsByDate(previous);
        showError(String(t("err_del_meal")));
      }
    },
    [activeMember?.id, mealsByDate, showError, t, targetMemberIds],
  );

  const handleDeleteAll = useCallback(
    (dateStr: string) => {
      const meals = mealsByDate[dateStr] ?? [];
      if (!meals.length) return;
      showConfirm({
        title: String(t("del_day_title")),
        message: String(
          typeof t("confirm_del_day") === "function"
            ? (t("confirm_del_day") as (n: number, d: string) => string)(
                meals.length,
                toEU(dateStr),
              )
            : t("confirm_del_day"),
        ),
        confirmLabel: String(t("btn_delete")),
        onConfirm: async () => {
          let previous: MealsByDate | undefined;
          setMealsByDate((prev) => {
            previous = prev;
            return clearDayInState(prev, dateStr);
          });
          try {
            const ids = await resolveMealIdsForAllMembers({
              dateStr,
              memberIds: targetMemberIds,
              mealsByDate,
              viewMemberId: activeMember?.id,
              getDay,
            });
            await Promise.all(ids.map((id) => deleteMeal(id)));
            showSuccess(String(t("day_deleted_ok")));
          } catch {
            if (previous) setMealsByDate(previous);
            showError(String(t("err_del_meals")));
          }
        },
      });
    },
    [
      activeMember?.id,
      mealsByDate,
      showConfirm,
      showError,
      showSuccess,
      t,
      targetMemberIds,
    ],
  );

  const handleCopyDay = useCallback(
    (ds: string) => {
      if (copiedDay === ds) {
        setCopiedDay(null);
        return;
      }
      setCopiedDay(ds);
      showInlineToast(
        String(
          typeof t("toast_copy_day") === "function"
            ? (t("toast_copy_day") as (d: string) => string)(toEU(ds))
            : t("toast_copy_day"),
        ),
      );
    },
    [copiedDay, showInlineToast, t],
  );

  const handlePasteDay = useCallback(
    async (target: string) => {
      if (!copiedDay || !targetMemberIds.length) return;
      try {
        await Promise.all(
          targetMemberIds.map((member_id) =>
            copyRange({
              source_start: copiedDay,
              source_end: copiedDay,
              target_start: target,
              member_id,
            }),
          ),
        );
        await loadMonth(year, month);
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? errorMessageFromBody(e.body, String(t("err_paste_day")))
            : String(t("err_paste_day"));
        showError(msg);
      }
    },
    [copiedDay, loadMonth, month, showError, t, targetMemberIds, year],
  );

  const handleDeleteWeek = useCallback(
    (mondayStr: string) => {
      const allMeals: Meal[] = [];
      for (let i = 0; i < 7; i++) {
        const ds = addDays(mondayStr, i);
        (mealsByDate[ds] ?? []).forEach((m) => allMeals.push(m));
      }
      if (!allMeals.length) return;
      showConfirm({
        title: String(t("del_week_title")),
        message: String(
          typeof t("confirm_del_week") === "function"
            ? (t("confirm_del_week") as (n: number) => string)(allMeals.length)
            : t("confirm_del_week"),
        ),
        confirmLabel: String(t("btn_delete")),
        onConfirm: async () => {
          try {
            const idSet = new Set<number>();
            for (let i = 0; i < 7; i++) {
              const ds = addDays(mondayStr, i);
              const ids = await resolveMealIdsForAllMembers({
                dateStr: ds,
                memberIds: targetMemberIds,
                mealsByDate,
                viewMemberId: activeMember?.id,
                getDay,
              });
              ids.forEach((id) => idSet.add(id));
            }
            await Promise.all([...idSet].map((id) => deleteMeal(id)));
            showSuccess(String(t("week_deleted_ok")));
            await loadMonth(year, month);
          } catch {
            showError(String(t("err_del_week")));
          }
        },
      });
    },
    [
      activeMember?.id,
      loadMonth,
      mealsByDate,
      month,
      showConfirm,
      showError,
      showSuccess,
      t,
      targetMemberIds,
      year,
    ],
  );

  const handleCopyWeek = useCallback(
    (mon: string) => {
      if (copiedWeek === mon) {
        setCopiedWeek(null);
        return;
      }
      setCopiedWeek(mon);

      const newSlots: TplSlots = {};
      for (let i = 0; i < 7; i++) {
        const ds = addDays(mon, i);
        (mealsByDate[ds] ?? []).forEach((m) => {
          newSlots[`${i}-${m.position}`] = toTplSlot(m.recipe);
        });
      }
      setTplSlots(newSlots);
      setTplOpen(true);
      showInlineToast(String(t("toast_copy_week")));
    },
    [copiedWeek, mealsByDate, showInlineToast, t],
  );

  const handlePasteWeek = useCallback(
    async (mon: string) => {
      if (!copiedWeek || !targetMemberIds.length) return;
      try {
        await Promise.all(
          targetMemberIds.map((member_id) =>
            copyRange({
              source_start: copiedWeek,
              source_end: addDays(copiedWeek, 6),
              target_start: mon,
              member_id,
            }),
          ),
        );
        await loadMonth(year, month);
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? errorMessageFromBody(e.body, String(t("err_paste_week")))
            : String(t("err_paste_week"));
        showError(msg);
      }
    },
    [copiedWeek, loadMonth, month, showError, t, targetMemberIds, year],
  );

  const saveTemplate = useCallback((name: string, meals: WeekTemplate["meals"]) => {
    const updated = [...templates, { name, meals }];
    setTemplates(updated);
    localStorage.setItem(WEEK_TEMPLATES_KEY, JSON.stringify(updated));
  }, [templates]);

  const deleteTemplate = useCallback(
    (i: number) => {
      const updated = templates.filter((_, idx) => idx !== i);
      setTemplates(updated);
      localStorage.setItem(WEEK_TEMPLATES_KEY, JSON.stringify(updated));
    },
    [templates],
  );

  const applyTemplate = useCallback(
    async (template: WeekTemplate, targetMon: string) => {
      if (!targetMemberIds.length) return;
      const offsets = [...new Set(template.meals.map((m) => m.dayOffset))];

      for (const member_id of targetMemberIds) {
        for (const offset of offsets) {
          const ds = addDays(targetMon, offset);
          let dayMeals: Meal[] = [];
          if (member_id === activeMember?.id) {
            dayMeals = mealsByDate[ds] ?? [];
          } else {
            try {
              dayMeals = await getDay(ds, member_id);
            } catch {
              dayMeals = [];
            }
          }
          await Promise.all(dayMeals.map((m) => deleteMeal(m.id)));
        }
        for (const entry of template.meals) {
          try {
            await addMeal({
              date: addDays(targetMon, entry.dayOffset),
              position: entry.position,
              recipe_id: entry.recipe_id,
              member_id,
            });
          } catch {
            // match CRA: swallow per-meal errors
          }
        }
      }
      await loadMonth(year, month);
    },
    [activeMember?.id, loadMonth, mealsByDate, month, targetMemberIds, year],
  );

  const handleDragEndRecipeDrop = useCallback(
    async (
      dragRecipe: RecipeSummary,
      targetDate: string,
      targetPos: number,
    ) => {
      if (!targetMemberIds.length) return;
      const displayMid = activeMember?.id;
      const tempId = -Date.now();
      if (displayMid && targetMemberIds.includes(displayMid)) {
        const optimistic = buildOptimisticMeal({
          date: targetDate,
          position: targetPos,
          recipe: dragRecipe,
          memberId: displayMid,
          tempId,
        });
        let previous: MealsByDate | undefined;
        setMealsByDate((prev) => {
          previous = prev;
          return upsertMealInState(prev, optimistic);
        });
        try {
          const results = await Promise.all(
            targetMemberIds.map((member_id) =>
              addMeal({
                date: targetDate,
                position: targetPos,
                recipe_id: dragRecipe.id,
                member_id,
              }),
            ),
          );
          const displayIdx = targetMemberIds.indexOf(displayMid);
          const res = displayIdx >= 0 ? results[displayIdx] : results[0];
          if (res) {
            setMealsByDate((prev) => {
              const next = removeMealFromState(prev, tempId, targetDate);
              return upsertMealInState(next, res);
            });
          }
        } catch {
          if (previous) setMealsByDate(previous);
          showError(String(t("err_add_meal")));
        }
      } else {
        try {
          await Promise.all(
            targetMemberIds.map((member_id) =>
              addMeal({
                date: targetDate,
                position: targetPos,
                recipe_id: dragRecipe.id,
                member_id,
              }),
            ),
          );
          await loadMonth(year, month);
        } catch {
          showError(String(t("err_add_meal")));
        }
      }
    },
    [
      activeMember?.id,
      loadMonth,
      month,
      showError,
      t,
      targetMemberIds,
      year,
    ],
  );

  const handleDragEndMealMove = useCallback(
    async (meal: Meal, targetDate: string, targetPos: number) => {
      if (meal.date === targetDate && meal.position === targetPos) return;
      const tempId = -Date.now();
      const optimistic: Meal = {
        ...meal,
        id: tempId,
        date: targetDate,
        position: targetPos,
      };
      let previous: MealsByDate | undefined;
      setMealsByDate((prev) => {
        previous = prev;
        const next = removeMealFromState(prev, meal.id, meal.date);
        return upsertMealInState(next, optimistic);
      });
      try {
        await deleteMeal(meal.id);
        const res = await addMeal({
          date: targetDate,
          position: targetPos,
          recipe_id: meal.recipe.id,
          member_id: activeMember?.id ?? meal.member_id,
        });
        setMealsByDate((prev) => {
          let next = removeMealFromState(prev, meal.id, meal.date);
          next = removeMealFromState(next, tempId, targetDate);
          return upsertMealInState(next, res);
        });
      } catch {
        if (previous) setMealsByDate(previous);
        showError(String(t("err_move_meal")));
        void loadMonth(year, month);
      }
    },
    [activeMember?.id, loadMonth, month, showError, t, year],
  );

  const handleDragEndDayCopy = useCallback(
    async (sourceDate: string, targetDate: string) => {
      if (sourceDate === targetDate || !targetMemberIds.length) return;
      try {
        await Promise.all(
          targetMemberIds.map((member_id) =>
            copyRange({
              source_start: sourceDate,
              source_end: sourceDate,
              target_start: targetDate,
              member_id,
            }),
          ),
        );
        await loadMonth(year, month);
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? errorMessageFromBody(e.body, String(t("err_copy_day")))
            : String(t("err_copy_day"));
        showError(msg);
      }
    },
    [loadMonth, month, showError, t, targetMemberIds, year],
  );

  const goToRecipes = useCallback(() => {
    router.push("/recipes");
  }, [router]);

  const openTemplateSection = useCallback(() => {
    setTplOpen(true);
    setTimeout(
      () =>
        document
          .getElementById("template-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      100,
    );
  }, []);

  const days = useMemo(() => getCalGrid(year, month), [year, month]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  return {
    t,
    year,
    month,
    todayStr,
    todayMidnight,
    recipes,
    mealsByDate,
    copiedDay,
    copiedWeek,
    inlineToast,
    calendarHelpOpen,
    setCalendarHelpOpen,
    carouselOpen,
    setCarouselOpen,
    recipeSearch,
    setRecipeSearch,
    carouselCatFilter,
    setCarouselCatFilter,
    carouselVisible,
    setCarouselVisible,
    tplSlots,
    setTplSlots,
    tplOpen,
    setTplOpen,
    previewRecipe,
    setPreviewRecipe,
    templates,
    macroGoals,
    containerRef,
    carouselScrollRef,
    prevMonth,
    nextMonth,
    handleToggleFavorite,
    handleDelete,
    handleDeleteAll,
    handleCopyDay,
    handlePasteDay,
    handleDeleteWeek,
    handleCopyWeek,
    handlePasteWeek,
    saveTemplate,
    deleteTemplate,
    applyTemplate,
    handleDragEndRecipeDrop,
    handleDragEndMealMove,
    handleDragEndDayCopy,
    goToRecipes,
    openTemplateSection,
    weeks,
  };
}
