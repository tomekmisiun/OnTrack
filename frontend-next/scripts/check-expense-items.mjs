import { strict as assert } from "node:assert";

/** Minimal mirror of computeExpenseItems coffee branch for regression guard. */
function coffeeDaily(drinks, effCukierPrice, effSlodzikPrice) {
  const n = (v) => parseFloat(v) || 0;
  const d = drinks;
  if (!d.kawa?.enabled) return 0;
  const gPerDay = n(d.kawa.cupsPerDay) * n(d.kawa.spoonsPerCup) * 3;
  let daily =
    (gPerDay / Math.max(1, n(d.kawa.pkgG))) * n(d.kawa.pkgPrice);
  if (d.kawa.sugarType) {
    const priceForType = (t) =>
      (3 / 1000) * (t === "cukier" ? effCukierPrice : effSlodzikPrice);
    daily +=
      n(d.kawa.cupsPerDay) * n(d.kawa.sugarSpoons) * priceForType(d.kawa.sugarType);
  }
  return daily;
}

const drinks = {
  kawa: {
    enabled: true,
    cupsPerDay: 2,
    spoonsPerCup: 2,
    pkgG: 200,
    pkgPrice: "20",
    sugarType: null,
    sugarSpoons: 1,
  },
};

const daily = coffeeDaily(drinks, 3.5, 15);
assert.ok(daily > 0, "coffee daily cost should be positive");
assert.ok(Math.abs(daily - 1.2) < 0.01, `expected ~1.2, got ${daily}`);

console.log("check-expense-items: ok");
