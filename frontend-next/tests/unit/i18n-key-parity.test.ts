import { describe, expect, it } from "vitest";
import { T } from "@/lib/i18n/translations";

function catalogKeys(locale: keyof typeof T): string[] {
  return Object.keys(T[locale]).sort();
}

describe("i18n key parity", () => {
  it("pl and en expose the same translation keys", () => {
    const plKeys = catalogKeys("pl");
    const enKeys = catalogKeys("en");
    expect(plKeys).toEqual(enKeys);
  });

  it("has no empty string values", () => {
    for (const locale of ["pl", "en"] as const) {
      for (const [key, value] of Object.entries(T[locale])) {
        if (typeof value === "string") {
          expect(value.length, `${locale}.${key}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
