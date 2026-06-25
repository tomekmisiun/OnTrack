import type { RecipeIngredient } from "@/types/recipe";

/** Average piece weight (g) — keep in sync with backend ingredient_units.py */
const PIECE_WEIGHT_G: Record<string, number> = {
  awokado: 200,
  avocado: 200,
  jajko: 60,
  jajka: 60,
  egg: 60,
  eggs: 60,
  czosnek: 5,
  garlic: 5,
};

function pieceWeightG(name: string): number {
  const key = name.toLowerCase().trim();
  if (PIECE_WEIGHT_G[key] != null) return PIECE_WEIGHT_G[key];
  for (const token of key.split(/\s+/)) {
    if (PIECE_WEIGHT_G[token] != null) return PIECE_WEIGHT_G[token];
  }
  return 100;
}

/** Display unit for recipe ingredient (API should set this; fallback for stale clients). */
export function resolveIngredientDisplayUnit(ing: RecipeIngredient): string {
  if (ing.unit !== "szt") return ing.unit || "g";

  const w = ing.weight;
  const pieceG = pieceWeightG(ing.product_name);
  if (Number.isInteger(w) && w >= 1 && w <= 12 && w <= Math.max(3, pieceG / 25)) {
    return "szt";
  }
  return "g";
}

/** Scale per-100g product macros to ingredient amount. */
export function ingredientMacroFactor(ing: RecipeIngredient): number {
  const unit = resolveIngredientDisplayUnit(ing);
  return unit === "szt" ? ing.weight : ing.weight / 100;
}
