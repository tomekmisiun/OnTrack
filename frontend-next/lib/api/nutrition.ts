import { createAuthedApiClient } from "@/lib/api/auth";
import type { LangCode } from "@/lib/i18n/translations";

export type NutritionLookupResponse = {
  found: boolean;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  source?: string;
  error?: string;
};

export async function lookupNutrition(
  name: string,
  lang: LangCode | string = "pl",
): Promise<NutritionLookupResponse> {
  const params = new URLSearchParams({
    name,
    lang: String(lang),
  });
  return createAuthedApiClient().get<NutritionLookupResponse>(
    `/api/nutrition/lookup?${params.toString()}`,
  );
}
