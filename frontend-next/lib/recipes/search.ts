import { stemIngredientWord } from "@/lib/recipes/ingredientStem";
import type { Product } from "@/types/product";

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j] ?? 0;
      row[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, row[j] ?? 0, row[j - 1] ?? 0);
      prev = tmp;
    }
  }
  return row[n] ?? 0;
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ą/g, "a")
    .replace(/ę/g, "e")
    .replace(/ó/g, "o")
    .replace(/ś/g, "s")
    .replace(/ź/g, "z")
    .replace(/ż/g, "z")
    .replace(/ć/g, "c")
    .replace(/ł/g, "l")
    .replace(/ń/g, "n");
}

const ING_STOP_WORDS = new Set([
  "oraz",
  "lub",
  "albo",
  "duze",
  "male",
  "duzy",
  "maly",
  "okolo",
  "bardzo",
  "swieze",
  "ugotowane",
  "posiekane",
  "uniwersalnej",
  "pelne",
  "niepelne",
  "niepelna",
  "niepelny",
  "nepelne",
  "nepelna",
  "szczypta",
  "srednie",
  "srednia",
  "sredni",
  "srednich",
  "pol",
  "polowa",
  "polowe",
  "niepelnych",
  "typu",
  "np",
  "xxl",
  "saszetka",
  "saszetki",
  "sztuki",
  "sztuk",
  "duza",
  "chwila",
  "and",
  "or",
  "very",
  "large",
  "big",
  "small",
  "little",
  "about",
  "approx",
  "approximately",
  "roughly",
  "whole",
  "medium",
  "extra",
  "type",
  "eg",
  "pkg",
  "package",
  "packet",
  "packets",
  "pieces",
  "piece",
  "taste",
  "optional",
  "chopped",
  "diced",
  "minced",
  "grated",
  "skinless",
  "fresh",
  "sliced",
  "peeled",
  "boneless",
  "trimmed",
  "drained",
  "rinsed",
  "thawed",
]);

const ING_QUALIFIERS = new Set([
  "slodka",
  "slodki",
  "slodkie",
  "roslinny",
  "roslinna",
  "roslinne",
  "waniliowy",
  "waniliowa",
  "waniliowe",
  "wanilinowy",
  "wanilinowa",
  "wanilinowe",
  "naturalny",
  "naturalna",
  "naturalne",
  "drobny",
  "drobna",
  "drobne",
  "mlody",
  "mloda",
  "mlode",
  "swiezy",
  "swieza",
  "swieze",
  "grecki",
  "grecka",
  "greckie",
  "malinowy",
  "malinowa",
  "malinowe",
  "bialy",
  "biala",
  "biale",
  "brazowy",
  "brazowa",
  "brazowe",
  "sweet",
  "plant",
  "based",
  "vanilla",
  "natural",
  "fine",
  "finely",
  "young",
  "greek",
  "raspberry",
  "strawberry",
  "chocolate",
  "lemon",
  "white",
  "brown",
  "organic",
  "vegan",
  "dairy",
  "free",
  "unsalted",
  "salted",
  "virgin",
  "frozen",
  "smoked",
  "roasted",
  "toasted",
  "ground",
  "powdered",
  "plain",
]);

function ingWords(text: string): string[] {
  return norm(text)
    .split(/[\s,.()"'\[\]-]+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !/^\d/.test(w) &&
        !ING_STOP_WORDS.has(w) &&
        !ING_QUALIFIERS.has(w),
    );
}

export { ingWords as ingredientWordsForMatch };

function wordsMatchPrimary(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 4) return false;
  if (a.slice(0, 3) !== b.slice(0, 3)) return false;
  if (
    (a.startsWith(b) || b.startsWith(a)) &&
    Math.abs(a.length - b.length) <= 2
  ) {
    return true;
  }
  return levenshtein(a, b) <= 1;
}

function matchWords(text: string): string[] {
  return ingWords(text).map(stemIngredientWord);
}

function prodWords(text: string): string[] {
  return norm(text)
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 2 && !ING_STOP_WORDS.has(w) && !ING_QUALIFIERS.has(w),
    );
}

export function unitFamily(unit: string): string {
  const u = (unit || "g").toLowerCase();
  if (u === "ml" || u === "l") return "volume";
  if (u === "szt") return "piece";
  return "mass";
}

export function unitsCompatible(ingUnit: string, product: Product): boolean {
  const ingFam = unitFamily(ingUnit);
  if (product.sold_by_weight) return ingFam === "mass";
  return ingFam === unitFamily(product.unit ?? "g");
}

export function ingredientMatchesProduct(
  ingredientText: string,
  productName: string,
): boolean {
  const words = matchWords(ingredientText);
  if (!words.length) return false;

  const pWords = prodWords(productName).map(stemIngredientWord);
  if (!pWords.length) return false;

  const primary = words[0];
  if (!primary || !pWords[0]) return false;
  if (!wordsMatchPrimary(primary, pWords[0])) return false;

  if (words.length === 1) return true;

  const restIng = words.slice(1);
  const restProd = pWords.slice(1);
  if (!restProd.length) return true;

  return restIng.every((iw) =>
    restProd.some((pw) => wordsMatchPrimary(iw, pw) || iw === pw),
  );
}

export function productMatchesIngredient(
  ingredientText: string,
  product: Product,
  ingUnit = "g",
): boolean {
  if (!unitsCompatible(ingUnit, product)) return false;
  return ingredientMatchesProduct(ingredientText, product.name);
}

function restProdHas(pWords: string[], word: string): boolean {
  return pWords
    .slice(1)
    .some((pw) => pw === word || wordsMatchPrimary(word, pw));
}

function scoreProductMatch(words: string[], productName: string): number {
  const pWords = prodWords(productName).map(stemIngredientWord);
  if (!pWords.length) return -1;

  let score = 0;
  if (pWords[0] === words[0]) score += 100;
  else if (words[0] && pWords[0] && wordsMatchPrimary(words[0], pWords[0]))
    score += 50;
  else return -1;

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    if (pWords.length === 1) break;
    if (restProdHas(pWords, word)) score += 20;
    else return -1;
  }

  if (pWords.length === words.length) score += 10;
  score -= (pWords.length - 1) * 5;
  return score;
}

export function pickBestMatchingProduct(
  ingredientText: string,
  products: Product[],
  ingUnit = "g",
): Product | null {
  const words = matchWords(ingredientText);
  if (!words.length) return null;

  let best: Product | null = null;
  let bestScore = -1;

  for (const p of products) {
    if (!productMatchesIngredient(ingredientText, p, ingUnit)) continue;
    const score = scoreProductMatch(words, p.name);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  return best;
}

export function fuzzySearch(query: string, text: string): boolean {
  if (!query) return true;
  const q = norm(query.trim());
  const t = norm(text);

  if (t.includes(q)) return true;

  const qWords = q.split(/\s+/).filter(Boolean);
  const tWords = t.split(/\s+/).filter(Boolean);

  return qWords.every((qw) => {
    if (qw.length < 4) return t.includes(qw);
    const threshold = Math.ceil(qw.length / 4);
    return tWords.some((tw) => levenshtein(qw, tw) <= threshold);
  });
}
