import { describe, expect, it } from "vitest";
import { parseRecipeText } from "@/lib/recipes/parseRecipeText";
import { fuzzySearch } from "@/lib/recipes/search";

describe("recipe search", () => {
  it("fuzzySearch matches and rejects", () => {
    expect(fuzzySearch("", "anything")).toBe(true);
    expect(fuzzySearch("chicken", "Chicken soup")).toBe(true);
    expect(fuzzySearch("chixen", "chicken soup")).toBe(true);
    expect(fuzzySearch("xyzabc", "chicken soup")).toBe(false);
  });

  it("parseRecipeText extracts ingredients", () => {
    const parsed = parseRecipeText(
      "Omlet\nJajka - 3 szt\nMleko - 200 ml\nSól - szczypta",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe("Omlet");
    expect(parsed!.ingredients.length).toBeGreaterThanOrEqual(2);
    expect(parsed!.ingredients[0]?.rawName.toLowerCase()).toBe("jajka");
    expect(parsed!.ingredients[0]?.unit).toBe("szt");
  });

  it("parseRecipeText returns null for empty input", () => {
    expect(parseRecipeText("   \n  ")).toBeNull();
  });
});
