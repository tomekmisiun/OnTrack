"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  currencyForMarket,
  currencyLabel,
  formatCurrencyAmount,
} from "@/lib/format/currency";

export function useMarketCurrency() {
  const { user } = useAuth();
  const code = currencyForMarket(user?.market_code);
  const label = currencyLabel(code);
  const format = (amount: number | null | undefined) =>
    formatCurrencyAmount(amount, code);
  return { code, label, format };
}
