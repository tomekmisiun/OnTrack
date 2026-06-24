import { norm, ingredientWordsForMatch } from "@/lib/recipes/search";
import { stemIngredientWord, TYPO_FIX } from "@/lib/recipes/ingredientStem";

const PL_DISPLAY: Record<string, string> = {
  maka: "mąka",
  maslo: "masło",
  cukier: "cukier",
  jajka: "jajka",
  jajko: "jajko",
  olej: "olej",
  mleko: "mleko",
  jogurt: "jogurt",
  kisiel: "kisiel",
  rabarbar: "rabarbar",
  sol: "sól",
  smietana: "śmietana",
  drozdze: "drożdże",
  pieczenia: "pieczenia",
};

const KEEP_PAIR: Record<string, Set<string>> = {
  maka: new Set(["pszenna", "pszenne", "tortowa", "tortowe", "razowa", "razowy"]),
  mleko: new Set(["krowie", "kokosowe", "owsiane"]),
  jogurt: new Set(["grecki", "grecka", "naturalny", "naturalna"]),
};

function displayWord(w: string): string {
  return PL_DISPLAY[w] ?? w;
}

export function canonicalizeIngredient(rawName: string): string {
  if (!rawName?.trim()) return "";

  let s = rawName.trim();
  s = s.replace(/\s*typu\s+["'«][^"'»]+["'»]/gi, "");
  s = s.replace(/\s*np\.?\s+[\wąćęłńóśźż-]+/gi, "");
  s = s.replace(/\s*\d+\s*(saszetk\w*|opakow\w*)\w*/gi, "");
  s = s.replace(/\bxxl\b/gi, "");
  s = s.replace(/["'«»]/g, " ");
  s = s.replace(/\s*-\s*$/, "");
  s = s.replace(/\s+/g, " ").trim();

  const words = ingWords(s).map((w) => stemIngredientWord(TYPO_FIX[w] ?? w));
  if (!words.length) return rawName.trim();

  const first = words[0];
  if (!first) return rawName.trim();

  const pair = KEEP_PAIR[first];
  const second = words[1];
  if (pair && second && pair.has(second)) {
    return `${displayWord(first)} ${second}`;
  }

  if (
    words.length >= 2 &&
    first === "proszek" &&
    (second === "pieczenia" || second === "pieczenie")
  ) {
    return `${displayWord(first)} do pieczenia`;
  }

  return displayWord(first);
}

function ingWords(text: string): string[] {
  return ingredientWordsForMatch(text);
}

export function canonicalDiffersFromRaw(
  rawName: string,
  canonicalName: string | undefined,
): boolean {
  if (!canonicalName || !rawName) return false;
  return (
    norm(canonicalName) !== norm(rawName) &&
    !norm(rawName).includes(norm(canonicalName))
  );
}
