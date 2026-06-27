import { describe, expect, it } from "vitest";
import { macroLabelsForLocale } from "@/lib/domain/market";
import { currencyForMarket } from "@/lib/format/currency";

describe("locale/market separation helpers", () => {
  it("macro labels follow ui_locale only", () => {
    expect(macroLabelsForLocale("pl")).toEqual(["B", "T", "W"]);
    expect(macroLabelsForLocale("en")).toEqual(["P", "F", "C"]);
  });

  it("currency follows market_code only", () => {
    expect(currencyForMarket("PL")).toBe("PLN");
    expect(currencyForMarket("GB")).toBe("GBP");
  });
});
