import type { LangCode } from "@/lib/i18n/translations";

const DEFAULT_PRIMARY: Record<LangCode, string> = { pl: "Ja", en: "Me" };

export function localizePrimaryName(
  name: string,
  lang: LangCode,
  isPrimary: boolean,
): string {
  if (!isPrimary) return name;
  const other: LangCode = lang === "pl" ? "en" : "pl";
  const otherDefault = DEFAULT_PRIMARY[other];
  if (name === otherDefault) return DEFAULT_PRIMARY[lang] ?? name;
  return name;
}

export function defaultPrimaryName(lang: LangCode): string {
  return DEFAULT_PRIMARY[lang] ?? "Ja";
}
