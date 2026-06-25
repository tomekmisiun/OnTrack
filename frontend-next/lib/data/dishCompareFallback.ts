import type { DishCompareResponse } from "@/lib/api/public";
import type { LangCode } from "@/lib/i18n/translations";

import en from "@/lib/data/dishCompare/en.json";
import pl from "@/lib/data/dishCompare/pl.json";

const FALLBACK: Record<LangCode, DishCompareResponse> = {
  pl: pl as DishCompareResponse,
  en: en as DishCompareResponse,
};

/** Bundled dish-compare payload when upstream API is unreachable (e.g. e2e, cold start). */
export function loadDishCompareFallback(
  lang: string,
): DishCompareResponse {
  if (lang === "en") return FALLBACK.en;
  return FALLBACK.pl;
}
