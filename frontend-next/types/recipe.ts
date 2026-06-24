import type { Product } from "@/types/product";

export type RecipeCategory =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "dessert";

export type RecipeIngredient = {
  id: number;
  product_id: number;
  product_name: string;
  package_weight: number | null;
  unit: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  weight: number;
  cost: number;
};

export type RecipeSummary = {
  id: number;
  name: string;
  notes: string | null;
  is_favorite: boolean;
  total_cost: number;
  total_kcal: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  kcal_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
  carbs_100g: number | null;
  image_url: string | null;
  source_url: string | null;
  category: string | null;
  servings: number;
  lang: string;
};

export type Recipe = RecipeSummary & {
  ingredients: RecipeIngredient[];
};

export type ParsedRecipeIngredient = {
  rawName: string;
  canonicalName?: string;
  weight: number;
  unit: string;
  product_id: number | null;
};

export type ParsedRecipe = {
  name: string;
  ingredients: ParsedRecipeIngredient[];
  sourceText: string;
  category: string | null;
  servings: string;
};

export type WeightParseResult = {
  weight: number;
  unit: string;
  matchIndex: number;
  matchEnd: number;
  forcedName?: string | null;
};

export type QuickProductForm = {
  name: string;
  package_weight: string;
  package_price: string;
  unit: string;
  sold_by_weight: boolean;
};

export type AddingIngredientState = {
  recipeId: number;
  search: string;
  product: Product | null;
  weight: string;
  showDrop: boolean;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
  unit: string;
  soldByWeight: boolean;
  priceOpak: string;
  pkgWeight: string;
  priceKg: string;
  priceSzt: string;
};

export type EditingIngCell = {
  key: string;
  field: "weight" | "macro" | "name";
  val?: string;
  vals?: { kcal: string; protein: string; fat: string; carbs: string };
};

function numOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function numOrZero(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

export function parseRecipeIngredient(data: unknown): RecipeIngredient | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.id !== "number" || typeof row.product_id !== "number") {
    return null;
  }
  if (typeof row.weight !== "number") return null;
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: typeof row.product_name === "string" ? row.product_name : "",
    package_weight: numOrNull(row.package_weight),
    unit: typeof row.unit === "string" ? row.unit : "g",
    kcal: numOrNull(row.kcal),
    protein: numOrNull(row.protein),
    fat: numOrNull(row.fat),
    carbs: numOrNull(row.carbs),
    weight: row.weight,
    cost: numOrZero(row.cost),
  };
}

export function parseRecipeSummary(data: unknown): RecipeSummary | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.id !== "number" || typeof row.name !== "string") return null;
  return {
    id: row.id,
    name: row.name,
    notes: typeof row.notes === "string" ? row.notes : null,
    is_favorite: Boolean(row.is_favorite),
    total_cost: numOrZero(row.total_cost),
    total_kcal: numOrZero(row.total_kcal),
    total_protein: numOrZero(row.total_protein),
    total_fat: numOrZero(row.total_fat),
    total_carbs: numOrZero(row.total_carbs),
    kcal_100g: numOrNull(row.kcal_100g),
    protein_100g: numOrNull(row.protein_100g),
    fat_100g: numOrNull(row.fat_100g),
    carbs_100g: numOrNull(row.carbs_100g),
    image_url: typeof row.image_url === "string" ? row.image_url : null,
    source_url: typeof row.source_url === "string" ? row.source_url : null,
    category: typeof row.category === "string" ? row.category : null,
    servings: typeof row.servings === "number" ? row.servings : 0,
    lang: typeof row.lang === "string" ? row.lang : "pl",
  };
}

export function parseRecipe(data: unknown): Recipe | null {
  const summary = parseRecipeSummary(data);
  if (!summary) return null;
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  const ingredients = Array.isArray(row.ingredients)
    ? row.ingredients
        .map((item) => parseRecipeIngredient(item))
        .filter((item): item is RecipeIngredient => item !== null)
    : [];
  return { ...summary, ingredients };
}

export function parseRecipeSummaryList(data: unknown): RecipeSummary[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => parseRecipeSummary(item))
    .filter((item): item is RecipeSummary => item !== null);
}

export const CAT_COLORS: Record<string, string> = {
  breakfast: "#f59e0b",
  lunch: "#10b981",
  dinner: "#6366f1",
  snack: "#0ea5e9",
  dessert: "#ec4899",
};
