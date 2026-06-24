import { describe, expect, it } from "vitest";
import {
  clearDayInState,
  removeMealFromState,
  upsertMealInState,
} from "@/lib/mealPlan/state";
import type { Meal, MealsByDate } from "@/types/mealPlan";

function meal(id: number, date: string, position: number): Meal {
  return {
    id,
    date,
    position,
    recipe_id: 1,
    member_id: 1,
    recipe: {
      id: 1,
      name: "Test",
      total_kcal: 100,
      total_protein: 10,
      total_fat: 5,
      total_carbs: 12,
      total_cost: 3,
    },
  };
}

describe("mealPlan state", () => {
  it("upserts and sorts meals by position", () => {
    const prev: MealsByDate = {
      "2026-05-23": [meal(1, "2026-05-23", 1)],
    };
    const next = upsertMealInState(prev, meal(2, "2026-05-23", 2));
    expect(next["2026-05-23"]).toHaveLength(2);
    expect(next["2026-05-23"]!.map((m) => m.position)).toEqual([1, 2]);
  });

  it("replaces same slot on upsert", () => {
    const prev: MealsByDate = {
      "2026-05-23": [meal(1, "2026-05-23", 1)],
    };
    const replacement = meal(99, "2026-05-23", 1);
    const next = upsertMealInState(prev, replacement);
    expect(next["2026-05-23"]).toHaveLength(1);
    expect(next["2026-05-23"]![0]!.id).toBe(99);
  });

  it("removes meal and prunes empty day", () => {
    const prev: MealsByDate = {
      "2026-05-23": [meal(1, "2026-05-23", 1)],
    };
    const next = removeMealFromState(prev, 1, "2026-05-23");
    expect(next["2026-05-23"]).toBeUndefined();
  });

  it("clearDayInState removes all meals for a date", () => {
    const prev: MealsByDate = {
      "2026-05-23": [meal(1, "2026-05-23", 1), meal(2, "2026-05-23", 2)],
    };
    const next = clearDayInState(prev, "2026-05-23");
    expect(next["2026-05-23"]).toBeUndefined();
  });
});
