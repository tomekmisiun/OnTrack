import type { ParsedProductText } from "@/types/product";

export function parseProductText(text: string): ParsedProductText | null {
  if (!text.trim()) return null;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const toG = (val: string | number, u: string) => {
    const v = parseFloat(String(val).replace(",", "."));
    if (u === "kg") return { w: Math.round(v * 1000), unit: "g" };
    if (u === "l") return { w: Math.round(v * 1000), unit: "ml" };
    return { w: Math.round(v), unit: u };
  };
  const stripWeight = (s: string) =>
    s
      .replace(/\d+(?:[,.]?\d+)?\s*(kg|g|ml|l|szt)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);
  const num = (s: string) => parseFloat(String(s).replace(",", "."));

  // ── Auchan ────────────────────────────────────────────────────
  if (/sprzedawcą jest auchan/i.test(text)) {
    const firstLine = lines[0] ?? "";
    const byWeight = /na\s+wagę/i.test(firstLine);
    const wm = firstLine.match(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\s*$/i);
    let weight = "";
    let unit = "g";
    let sold_by_weight = byWeight;
    if (wm) {
      const { w, unit: u } = toG(wm[1] ?? "", wm[2]?.toLowerCase() ?? "g");
      weight = String(w);
      unit = u;
      if (wm[2]?.toLowerCase() === "kg" && !byWeight) sold_by_weight = false;
    }
    const name = stripWeight(firstLine.replace(/na\s+wagę/gi, ""));
    const allPrices = [...text.matchAll(/(\d+[,.]?\d*)\s*zł(?!\/|\s*\/)/gi)];
    const price = allPrices.length
      ? String(num(allPrices[allPrices.length - 1]?.[1] ?? "0").toFixed(2))
      : "";
    return { name, package_price: price, package_weight: weight, unit, sold_by_weight };
  }

  // ── Carrefour (nazwa powtórzona w 2 pierwszych liniach) ───────
  if (lines.length >= 2 && lines[0] === lines[1]) {
    const firstLine = lines[0] ?? "";
    const wm = firstLine.match(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\s*$/i);
    let weight = "";
    let unit = "g";
    if (wm) {
      const r = toG(wm[1] ?? "", wm[2]?.toLowerCase() ?? "g");
      weight = String(r.w);
      unit = r.unit;
    }
    const name = stripWeight(firstLine);
    let price = "";
    const pkgKgM = text.match(/(\d+[,.]?\d+)\s*zł\/1?\s*kg/i);
    if (pkgKgM && weight) {
      price = (num(pkgKgM[1] ?? "0") * parseFloat(weight) / 1000).toFixed(2);
    } else {
      const zlIdx = lines.findIndex((l) => /^zł$/i.test(l));
      if (
        zlIdx >= 2 &&
        /^\d+$/.test(lines[zlIdx - 2] ?? "") &&
        /^\d+$/.test(lines[zlIdx - 1] ?? "")
      ) {
        price = `${lines[zlIdx - 2]}.${lines[zlIdx - 1]}`;
      }
    }
    return {
      name,
      package_price: price,
      package_weight: weight,
      unit,
      sold_by_weight: false,
    };
  }

  // ── Biedronka (Nazwa Weight\nWeight - Price zł / kg) ─────────
  {
    const firstLine = lines[0] ?? "";
    const wm = firstLine.match(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\s*$/i);
    const pkgKgM = text.match(/(\d+[,.]?\d+)\s*zł\s*\/\s*kg/i);
    if (wm && pkgKgM) {
      const { w, unit } = toG(wm[1] ?? "", wm[2]?.toLowerCase() ?? "g");
      const pricePerKg = num(pkgKgM[1] ?? "0");
      const price = (pricePerKg * w / 1000).toFixed(2);
      const name = stripWeight(firstLine);
      return {
        name,
        package_price: price,
        package_weight: String(w),
        unit,
        sold_by_weight: false,
      };
    }
  }

  // ── Fallback ──────────────────────────────────────────────────
  const isByWeight = /na\s+wagę/i.test(text) || /zł\/kg/i.test(text);
  let price = "";
  let weight = "";
  let unit = "g";
  if (isByWeight) {
    const m = text.match(/(\d+[,.]?\d*)\s*zł\/kg/i);
    if (m) price = String(num(m[1] ?? "0").toFixed(2));
  } else {
    const wm = text.match(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\b/i);
    if (wm) {
      const r = toG(wm[1] ?? "", wm[2]?.toLowerCase() ?? "g");
      weight = String(r.w);
      unit = r.unit;
    }
    const mZl = text.match(/(\d+[,.]?\d*)\s*(zł|£|GBP)(?!\/)/i);
    if (mZl) {
      price = String(num(mZl[1] ?? "0").toFixed(2));
    } else {
      const mBare = text
        .replace(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\b/i, "")
        .match(/(\d+[,.]?\d*)(?:\s*)$/);
      if (mBare && weight) price = String(num(mBare[1] ?? "0").toFixed(2));
    }
  }
  const name = stripWeight(
    (lines[0] ?? "").replace(/na\s+wagę/gi, "").replace(/kiść/gi, ""),
  );
  return {
    name,
    package_price: price,
    package_weight: weight,
    unit,
    sold_by_weight: isByWeight,
  };
}
