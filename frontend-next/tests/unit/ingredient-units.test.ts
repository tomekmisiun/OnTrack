import { describe, expect, it } from "vitest";
import {
  ingredientMacroFactor,
  resolveIngredientDisplayUnit,
} from "@/lib/recipes/ingredientUnits";
import type { RecipeIngredient } from "@/types/recipe";

function ing(
  weight: number,
  unit: string,
  name = "awokado",
): RecipeIngredient {
  return {
    id: 1,
    product_id: 1,
    product_name: name,
    package_weight: 1,
    unit,
    kcal: 160,
    protein: 2,
    fat: 14.7,
    carbs: 8.5,
    weight,
    cost: 0,
  };
}

describe("resolveIngredientDisplayUnit", () => {
  it("shows grams for 100g avocado on szt product", () => {
    expect(resolveIngredientDisplayUnit(ing(100, "szt"))).toBe("g");
  });

  it("shows grams for 50g avocado on szt product", () => {
    expect(resolveIngredientDisplayUnit(ing(50, "szt"))).toBe("g");
  });

  it("shows pcs for 2 eggs", () => {
    expect(resolveIngredientDisplayUnit(ing(2, "szt", "jajka"))).toBe("szt");
  });

  it("shows grams for 120g eggs", () => {
    expect(resolveIngredientDisplayUnit(ing(120, "szt", "jajka"))).toBe("g");
  });
});

describe("ingredientMacroFactor", () => {
  it("uses per-100g scale for gram amounts", () => {
    expect(ingredientMacroFactor(ing(100, "szt"))).toBe(1);
  });

  it("does not multiply macros by 100 for large szt mislabels", () => {
    const factor = ingredientMacroFactor(ing(100, "szt"));
    expect(Math.round(160 * factor)).toBe(160);
  });
});
