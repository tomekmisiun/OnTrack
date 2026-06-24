import type { Product } from "@/types/product";

export function toUnitPrice(
  packagePrice: string | number,
  packageWeight: string | number,
  unit: string,
): number {
  const pkg = parseFloat(String(packageWeight)) || 1;
  const price = parseFloat(String(packagePrice)) || 0;
  return unit === "szt" ? price / pkg : (price / pkg) * 100;
}

export function toPackagePrice(
  unitPrice: string | number,
  packageWeight: string | number,
  unit: string,
): number {
  const pkg = parseFloat(String(packageWeight)) || 1;
  const price = parseFloat(String(unitPrice)) || 0;
  return unit === "szt" ? price * pkg : (price * pkg) / 100;
}

export function displayPrice(p: Product, currency: string): string {
  if (!p.price) return "-";
  if (p.sold_by_weight) {
    return `${toPackagePrice(p.price, 1000, "g").toFixed(2)} ${currency}/kg`;
  }
  return `${toPackagePrice(p.price, p.package_weight, p.unit || "g").toFixed(2)} ${currency}`;
}

export function clamp(v: string | number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, parseFloat(String(v)) || 0));
}

export function numClamp(
  v: string | number,
  hi = 99999,
  lo = 0,
): string | number {
  if (v === "") return "";
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? v : String(Math.min(hi, Math.max(lo, n)));
}
