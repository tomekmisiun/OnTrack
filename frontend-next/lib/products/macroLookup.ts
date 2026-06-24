import { lookupNutrition } from "@/lib/api/nutrition";
import type { LangCode } from "@/lib/i18n/translations";

export type ProductMacros = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type MacroLookupResult = {
  macros: ProductMacros | null;
  source: string | null;
  error?: string;
};

/** Fetch per-100g macros via backend (local DB → cache → DeepSeek). */
export async function fetchProductMacros(
  name: string,
  lang: LangCode = "pl",
): Promise<MacroLookupResult> {
  try {
    const d = await lookupNutrition(name, lang);
    if (!d?.found) {
      return { macros: null, source: null, error: d?.error };
    }
    if (
      typeof d.kcal !== "number" ||
      typeof d.protein !== "number" ||
      typeof d.fat !== "number" ||
      typeof d.carbs !== "number"
    ) {
      return { macros: null, source: null, error: "invalid_response" };
    }
    return {
      macros: {
        kcal: d.kcal,
        protein: d.protein,
        fat: d.fat,
        carbs: d.carbs,
      },
      source: typeof d.source === "string" ? d.source : null,
    };
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "body" in e &&
      typeof (e as { body: unknown }).body === "object" &&
      (e as { body: { found?: boolean } }).body !== null
    ) {
      const data = (e as { body: { found?: boolean; error?: string } }).body;
      if (data.found === false) {
        return {
          macros: null,
          source: null,
          error: data.error || "not_found",
        };
      }
    }
    return { macros: null, source: null, error: "lookup_failed" };
  }
}
