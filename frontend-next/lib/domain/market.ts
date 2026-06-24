import type { LangCode } from "@/lib/i18n/translations";

export type MarketCode = "PL" | "GB";

export function catalogLangForMarket(marketCode: string | undefined | null): LangCode {
  return marketCode === "GB" ? "en" : "pl";
}

export function defaultMarketForUiLocale(uiLocale: LangCode): MarketCode {
  return uiLocale === "en" ? "GB" : "PL";
}
