import { enMessages } from "@/lib/i18n/messages/en";
import { plMessages } from "@/lib/i18n/messages/pl";

export type LangCode = "pl" | "en";

export const DEFAULT_UI_LOCALE: LangCode = "pl";

export const T = {
  pl: plMessages,
  en: enMessages,
} as const;

export type TranslationKey = keyof typeof T.pl;

export type TranslationValue = (typeof T)[LangCode][TranslationKey];
