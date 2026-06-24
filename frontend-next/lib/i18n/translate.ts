import type { TranslationKey } from "@/lib/i18n/translations";

type TFn = (key: TranslationKey) => unknown;

export function tString(t: TFn, key: TranslationKey): string {
  return String(t(key));
}

export function tFormat(t: TFn, key: TranslationKey, arg: string): string {
  const value = t(key);
  if (typeof value === "function") {
    return String((value as (name: string) => string)(arg));
  }
  return String(value);
}

export function tFormatN(t: TFn, key: TranslationKey, arg: number): string {
  const value = t(key);
  if (typeof value === "function") {
    return String((value as (n: number) => string)(arg));
  }
  return String(value);
}

export function tFormat2(
  t: TFn,
  key: TranslationKey,
  a: number,
  b: number,
): string {
  const value = t(key);
  if (typeof value === "function") {
    return String((value as (x: number, y: number) => string)(a, b));
  }
  return String(value);
}

export function tFormatArgs(
  t: TFn,
  key: TranslationKey,
  ...args: (string | number | boolean)[]
): string {
  const value = t(key);
  if (typeof value === "function") {
    return String(
      (value as (...a: (string | number | boolean)[]) => string)(...args),
    );
  }
  return String(value);
}

export function tArray(t: TFn, key: TranslationKey): string[] {
  const value = t(key);
  return Array.isArray(value) ? value.map(String) : [];
}
