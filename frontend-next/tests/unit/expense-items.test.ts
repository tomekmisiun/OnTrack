import { describe, expect, it } from "vitest";
import { DRINKS_DEFAULTS } from "@/lib/summary/expenseDefaults";
import { computeExpenseItems } from "@/lib/summary/expenseItems";

describe("expenseItems", () => {
  it("computes positive coffee daily cost", () => {
    const drinks = {
      ...DRINKS_DEFAULTS,
      kawa: {
        ...DRINKS_DEFAULTS.kawa,
        enabled: true,
        cupsPerDay: 2,
        spoonsPerCup: 2,
        pkgG: 200,
        pkgPrice: "20",
        sugarType: null,
        sugarSpoons: 1,
      },
    };

    const items = computeExpenseItems(30, drinks, {}, 3.5, 15);
    const coffee = items.find((item) => item._dk === "kawa");
    expect(coffee).toBeDefined();
    expect(coffee!.daily).toBeGreaterThan(0);
    expect(Math.abs(coffee!.daily - 1.2)).toBeLessThan(0.01);
  });
});
