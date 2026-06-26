/** Patch calendar meal map without reloading the whole month. */

export function upsertMealInState(prev, meal) {
  const date = meal.date;
  const dayMeals = (prev[date] || []).filter(
    (m) => m.position !== meal.position && m.id !== meal.id,
  );
  return {
    ...prev,
    [date]: [...dayMeals, meal].sort((a, b) => a.position - b.position),
  };
}

export function removeMealFromState(prev, mealId, date) {
  const dayMeals = (prev[date] || []).filter((m) => m.id !== mealId);
  const next = { ...prev };
  if (dayMeals.length) next[date] = dayMeals;
  else delete next[date];
  return next;
}

export function clearDayInState(prev, date) {
  if (!prev[date]?.length) return prev;
  const next = { ...prev };
  delete next[date];
  return next;
}

export function findMealDate(prev, mealId) {
  return Object.keys(prev).find((d) => (prev[d] || []).some((m) => m.id === mealId));
}

export function recipeSnapshotFromCarousel(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    total_kcal: recipe.total_kcal,
    total_protein: recipe.total_protein,
    total_fat: recipe.total_fat,
    total_carbs: recipe.total_carbs,
    total_cost: recipe.total_cost,
  };
}

export function buildOptimisticMeal({ date, position, recipe, memberId, tempId }) {
  return {
    id: tempId,
    date,
    position,
    recipe_id: recipe.id,
    member_id: memberId,
    recipe: recipeSnapshotFromCarousel(recipe),
  };
}

/** Posiłki do usunięcia u wszystkich zaznaczonych domowników (ten sam dzień + opcjonalnie slot). */
export async function resolveMealIdsForAllMembers({
  dateStr,
  position,
  memberIds,
  mealsByDate,
  viewMemberId,
  getDay,
}) {
  if (!dateStr || !memberIds?.length) return [];

  const ids = new Set();
  await Promise.all(memberIds.map(async (memberId) => {
    let dayMeals = [];
    if (memberId === viewMemberId) {
      dayMeals = mealsByDate[dateStr] || [];
    } else {
      try {
        const res = await getDay(dateStr, memberId);
        dayMeals = res.data || [];
      } catch {
        dayMeals = [];
      }
    }
    const matches = position != null
      ? dayMeals.filter(m => m.position === position)
      : dayMeals;
    matches.forEach(m => ids.add(m.id));
  }));

  return [...ids];
}
