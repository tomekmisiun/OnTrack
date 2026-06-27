import type { LangCode } from "@/lib/i18n/translations";

export type MarketCode = "PL" | "GB";

export function defaultMarketForUiLocale(uiLocale: LangCode): MarketCode {
  return uiLocale === "en" ? "GB" : "PL";
}

export function macroLabelsForLocale(uiLocale: LangCode): readonly [string, string, string] {
  return uiLocale === "en" ? (["P", "F", "C"] as const) : (["B", "T", "W"] as const);
}
