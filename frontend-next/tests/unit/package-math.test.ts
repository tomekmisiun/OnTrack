import { describe, expect, it } from "vitest";
import {
  PACKAGE_MATH_VECTORS,
  defaultPackageWeight,
  packageLineCosts,
  pricePerPackage,
} from "@/lib/summary/package-math";

describe("package-math parity vectors", () => {
  it.each(PACKAGE_MATH_VECTORS)("$label", (vector) => {
    const pkg = defaultPackageWeight(vector.packageWeight, vector.unit);
    const packagePrice = pricePerPackage(
      vector.unitPrice,
      pkg,
      vector.unit,
    );
    expect(packagePrice).toBeCloseTo(vector.expectedPricePerPackage, 5);

    const costs = packageLineCosts({
      totalWeight: vector.totalWeight,
      packageWeight: pkg,
      pricePerPackage: packagePrice,
      soldByWeight: vector.soldByWeight,
    });
    expect(costs.packagesExact).toBe(vector.expected.packagesExact);
    expect(costs.packagesRounded).toBe(vector.expected.packagesRounded);
    expect(costs.totalCost).toBe(vector.expected.totalCost);
    expect(costs.actualCost).toBe(vector.expected.actualCost);
  });

  it("uses default package weights", () => {
    expect(defaultPackageWeight(null, "g")).toBe(1000);
    expect(defaultPackageWeight(0, "szt")).toBe(1);
  });
});
