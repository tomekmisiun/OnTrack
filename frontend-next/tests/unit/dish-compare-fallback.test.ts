import { describe, expect, it } from "vitest";

import { loadDishCompareFallback } from "@/lib/data/dishCompareFallback";

describe("loadDishCompareFallback", () => {
  it("returns Polish demo dishes by default", () => {
    const data = loadDishCompareFallback("pl");
    expect(data.dishes.length).toBeGreaterThan(0);
    expect(data.dishes[0]?.id).toBe("pizza_margherita");
  });

  it("returns English demo dishes for en", () => {
    const data = loadDishCompareFallback("en");
    expect(data.dishes.length).toBeGreaterThan(0);
    expect(data.dishes[0]?.portion_note).toMatch(/demo/i);
  });

  it("falls back to Polish for unknown lang", () => {
    const data = loadDishCompareFallback("de");
    expect(data.dishes[0]?.id).toBe("pizza_margherita");
  });
});
