import type { Meal, MealsByDate } from "@/types/mealPlan";
import type { RecipeSummary } from "@/types/recipe";
import { recipeSnapshotFromCarousel } from "@/types/mealPlan";

/** Patch calendar meal map without reloading the whole month. */
export function upsertMealInState(prev: MealsByDate, meal: Meal): MealsByDate {
  const date = meal.date;
  const dayMeals = (prev[date] ?? []).filter(
    (m) => m.position !== meal.position && m.id !== meal.id,
  );
  return {
    ...prev,
    [date]: [...dayMeals, meal].sort((a, b) => a.position - b.position),
  };
}

export function removeMealFromState(
  prev: MealsByDate,
  mealId: number,
  date: string,
): MealsByDate {
  const dayMeals = (prev[date] ?? []).filter((m) => m.id !== mealId);
  const next = { ...prev };
  if (dayMeals.length) next[date] = dayMeals;
  else delete next[date];
  return next;
}

export function clearDayInState(prev: MealsByDate, date: string): MealsByDate {
  if (!prev[date]?.length) return prev;
  const next = { ...prev };
  delete next[date];
  return next;
}

export function findMealDate(prev: MealsByDate, mealId: number): string | undefined {
  return Object.keys(prev).find((d) => (prev[d] ?? []).some((m) => m.id === mealId));
}

export function buildOptimisticMeal({
  date,
  position,
  recipe,
  memberId,
  tempId,
}: {
  date: string;
  position: number;
  recipe: RecipeSummary;
  memberId: number;
  tempId: number;
}): Meal {
  return {
    id: tempId,
    date,
    position,
    recipe_id: recipe.id,
    member_id: memberId,
    recipe: recipeSnapshotFromCarousel(recipe),
  };
}

type GetDayFn = (date: string, memberId?: number) => Promise<Meal[]>;

/** Meals to delete for all selected household members (same day + optional slot). */
export async function resolveMealIdsForAllMembers({
  dateStr,
  position,
  memberIds,
  mealsByDate,
  viewMemberId,
  getDay,
}: {
  dateStr: string;
  position?: number;
  memberIds: number[];
  mealsByDate: MealsByDate;
  viewMemberId: number | null | undefined;
  getDay: GetDayFn;
}): Promise<number[]> {
  if (!dateStr || !memberIds.length) return [];

  const ids = new Set<number>();
  await Promise.all(
    memberIds.map(async (memberId) => {
      let dayMeals: Meal[] = [];
      if (memberId === viewMemberId) {
        dayMeals = mealsByDate[dateStr] ?? [];
      } else {
        try {
          dayMeals = await getDay(dateStr, memberId);
        } catch {
          dayMeals = [];
        }
      }
      const matches =
        position != null
          ? dayMeals.filter((m) => m.position === position)
          : dayMeals;
      matches.forEach((m) => ids.add(m.id));
    }),
  );

  return [...ids];
}
