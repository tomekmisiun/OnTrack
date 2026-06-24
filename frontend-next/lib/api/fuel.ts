import { createAuthedApiClient } from "@/lib/api/auth";
import type { LangCode } from "@/lib/i18n/translations";

export type FuelPrices = Record<string, number>;

export async function getFuelPrices(
  lang: LangCode | string = "pl",
): Promise<FuelPrices> {
  const params = new URLSearchParams({ lang: String(lang) });
  return createAuthedApiClient().get<FuelPrices>(
    `/api/fuel/prices?${params.toString()}`,
  );
}
