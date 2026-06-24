import type { RecipeSummary } from "@/types/recipe";

export type MealRecipeSnapshot = {
  id: number;
  name: string;
  total_kcal: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  total_cost: number;
  kcal_100g?: number | null;
  protein_100g?: number | null;
  fat_100g?: number | null;
  carbs_100g?: number | null;
  image_url?: string | null;
  source_url?: string | null;
};

export type Meal = {
  id: number;
  date: string;
  position: number;
  recipe_id: number;
  member_id: number;
  recipe: MealRecipeSnapshot;
};

export type MealsByDate = Record<string, Meal[]>;

export type WeekTemplateMeal = {
  dayOffset: number;
  position: number;
  recipe_id: number;
  recipe_name: string;
};

export type WeekTemplate = {
  name: string;
  meals: WeekTemplateMeal[];
};

export type TplSlotRecipe = {
  id: number;
  name: string;
  total_kcal: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  total_cost: number;
};

export type TplSlots = Record<string, TplSlotRecipe>;

function numOrZero(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

export function parseMealRecipeSnapshot(data: unknown): MealRecipeSnapshot | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.id !== "number" || typeof row.name !== "string") return null;
  return {
    id: row.id,
    name: row.name,
    total_kcal: numOrZero(row.total_kcal),
    total_protein: numOrZero(row.total_protein),
    total_fat: numOrZero(row.total_fat),
    total_carbs: numOrZero(row.total_carbs),
    total_cost: numOrZero(row.total_cost),
    kcal_100g: numOrNull(row.kcal_100g),
    protein_100g: numOrNull(row.protein_100g),
    fat_100g: numOrNull(row.fat_100g),
    carbs_100g: numOrNull(row.carbs_100g),
    image_url: typeof row.image_url === "string" ? row.image_url : null,
    source_url: typeof row.source_url === "string" ? row.source_url : null,
  };
}

export function parseMeal(data: unknown): Meal | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  if (
    typeof row.id !== "number" ||
    typeof row.date !== "string" ||
    typeof row.position !== "number" ||
    typeof row.recipe_id !== "number" ||
    typeof row.member_id !== "number"
  ) {
    return null;
  }
  const recipe = parseMealRecipeSnapshot(row.recipe);
  if (!recipe) return null;
  return {
    id: row.id,
    date: row.date,
    position: row.position,
    recipe_id: row.recipe_id,
    member_id: row.member_id,
    recipe,
  };
}

export function parseMealList(data: unknown): Meal[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => parseMeal(item))
    .filter((item): item is Meal => item !== null);
}

export function parseMealsByDate(data: unknown): MealsByDate {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {};
  }
  const result: MealsByDate = {};
  for (const [date, meals] of Object.entries(data)) {
    const parsed = parseMealList(meals);
    if (parsed.length) result[date] = parsed;
  }
  return result;
}

export function recipeSnapshotFromCarousel(recipe: RecipeSummary): MealRecipeSnapshot {
  return {
    id: recipe.id,
    name: recipe.name,
    total_kcal: recipe.total_kcal,
    total_protein: recipe.total_protein,
    total_fat: recipe.total_fat,
    total_carbs: recipe.total_carbs,
    total_cost: recipe.total_cost,
    kcal_100g: recipe.kcal_100g ?? null,
    protein_100g: recipe.protein_100g ?? null,
    fat_100g: recipe.fat_100g ?? null,
    carbs_100g: recipe.carbs_100g ?? null,
    image_url: recipe.image_url,
    source_url: recipe.source_url,
  };
}
