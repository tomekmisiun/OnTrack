import type { LangCode } from "@/lib/i18n/translations";
import type { MarketCode } from "@/lib/domain/market";
import { defaultMarketForUiLocale } from "@/lib/domain/market";

/** User payload from GET /api/auth/me (until OpenAPI adds UserResponse). */
export type AuthUser = {
  id: number;
  lang: LangCode;
  ui_locale: LangCode;
  market_code: MarketCode;
  username?: string;
  email?: string;
};

export function parseAuthUser(data: unknown): AuthUser | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.id !== "number") return null;

  const uiLocale: LangCode =
    row.ui_locale === "pl" || row.ui_locale === "en"
      ? row.ui_locale
      : row.lang === "pl" || row.lang === "en"
        ? row.lang
        : "en";

  const marketCode: MarketCode =
    row.market_code === "PL" || row.market_code === "GB"
      ? row.market_code
      : defaultMarketForUiLocale(uiLocale);

  const user: AuthUser = {
    id: row.id,
    lang: uiLocale,
    ui_locale: uiLocale,
    market_code: marketCode,
  };
  if (typeof row.username === "string") user.username = row.username;
  if (typeof row.email === "string") user.email = row.email;
  return user;
}
