import type { MarketCode } from "@/lib/domain/market";

export function currencyForMarket(marketCode: MarketCode | string | undefined | null): string {
  return marketCode === "GB" ? "GBP" : "PLN";
}

export function currencyLabel(currency: string | null | undefined): string {
  if (currency === "GBP") return "£";
  if (currency === "PLN") return "zł";
  return currency ?? "zł";
}

export function formatCurrencyAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const code = currency ?? "PLN";
  if (code === "GBP") return `£${amount.toFixed(2)}`;
  if (code === "PLN") return `${amount.toFixed(2)} zł`;
  return `${amount.toFixed(2)} ${code}`;
}
