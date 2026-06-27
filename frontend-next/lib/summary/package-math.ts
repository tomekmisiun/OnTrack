/** Package weight and shopping-list cost calculations (parity with backend domain/package_math.py). */

export function defaultPackageWeight(
  packageWeight: number | null | undefined,
  unit: string,
): number {
  if (packageWeight) return packageWeight;
  return unit === "szt" ? 1 : 1000;
}

export function pricePerPackage(
  unitPrice: number,
  packageWeight: number,
  unit: string,
): number {
  return unit === "szt"
    ? unitPrice * packageWeight
    : (unitPrice * packageWeight) / 100;
}

export function packageLineCosts(input: {
  totalWeight: number;
  packageWeight: number;
  pricePerPackage: number;
  soldByWeight: boolean;
}): {
  packagesExact: number;
  packagesRounded: number;
  totalCost: number;
  actualCost: number;
} {
  const packagesExact = input.totalWeight / input.packageWeight;
  const actualCost = packagesExact * input.pricePerPackage;
  const packagesRounded = input.soldByWeight
    ? packagesExact
    : Math.ceil(packagesExact);
  const totalCost = input.soldByWeight
    ? actualCost
    : packagesRounded * input.pricePerPackage;
  return {
    packagesExact: round2(packagesExact),
    packagesRounded: round2(packagesRounded),
    totalCost: round2(totalCost),
    actualCost: round2(actualCost),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type PackageMathVector = {
  label: string;
  unit: string;
  unitPrice: number;
  packageWeight: number | null;
  totalWeight: number;
  soldByWeight: boolean;
  expectedPricePerPackage: number;
  expected: {
    packagesExact: number;
    packagesRounded: number;
    totalCost: number;
    actualCost: number;
  };
};

/** Shared vectors — keep in sync with backend/tests/test_package_math.py */
export const PACKAGE_MATH_VECTORS: PackageMathVector[] = [
  {
    label: "grams discrete packages",
    unit: "g",
    unitPrice: 4.99,
    packageWeight: 500,
    totalWeight: 750,
    soldByWeight: false,
    expectedPricePerPackage: 24.95,
    expected: {
      packagesExact: 1.5,
      packagesRounded: 2,
      totalCost: 49.9,
      actualCost: 37.42,
    },
  },
  {
    label: "grams sold by weight",
    unit: "g",
    unitPrice: 4.99,
    packageWeight: 500,
    totalWeight: 750,
    soldByWeight: true,
    expectedPricePerPackage: 24.95,
    expected: {
      packagesExact: 1.5,
      packagesRounded: 1.5,
      totalCost: 37.42,
      actualCost: 37.42,
    },
  },
  {
    label: "count discrete packages",
    unit: "szt",
    unitPrice: 2.5,
    packageWeight: 6,
    totalWeight: 7,
    soldByWeight: false,
    expectedPricePerPackage: 15,
    expected: {
      packagesExact: 1.17,
      packagesRounded: 2,
      totalCost: 30,
      actualCost: 17.5,
    },
  },
];
