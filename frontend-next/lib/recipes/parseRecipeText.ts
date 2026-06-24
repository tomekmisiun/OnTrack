import { canonicalizeIngredient } from "@/lib/recipes/ingredientCanonical";
import {
  pickBestMatchingProduct,
  productMatchesIngredient,
} from "@/lib/recipes/search";
import type {
  ParsedRecipe,
  ParsedRecipeIngredient,
  WeightParseResult,
} from "@/types/recipe";
import type { Product } from "@/types/product";

const POLISH_UNITS = [
  { re: /szklank[iaę]|szklanek/i, g: 250 },
  { re: /łyżk[iaę]|łyżek(?!czk)/i, g: 15 },
  { re: /łyżeczk[iaę]|łyżeczek/i, g: 5 },
  { re: /szczypt[aę]|szczypty/i, g: 1 },
  { re: /garśc[i]?|garść/i, g: 30 },
  { re: /pęczk[iaó]?|pęczków/i, g: 50 },
  { re: /kostek?|kostki|kostkę/i, g: 200 },
];

const ENGLISH_UNITS = [
  { re: /\bcups?\b|\bc\b(?!\w)/i, ml: 240, g: 240 },
  { re: /tablespoons?|tbsp\.?/i, g: 15 },
  { re: /teaspoons?|tsp\.?/i, g: 5 },
  { re: /(?:pounds?|lbs?\.?)/i, g: 454 },
  { re: /(?:ounces?|oz\.?)/i, g: 28 },
];

const PIECE_WORDS =
  /jajk[ao]|jajek|jaja?(?=\s)|jaj\b|sztuk[ia]?|szt\.?|\beggs?\b|\bcloves?\b|\bonions?\b|\bpieces?\b|\bpcs\b/i;

const FRACTION_WORDS: Record<string, number> = {
  pół: 0.5,
  ćwierć: 0.25,
  half: 0.5,
  quarter: 0.25,
};

function parseNum(s: string): number | null {
  if (!s) return null;
  const trimmed = s.trim();
  for (const [w, v] of Object.entries(FRACTION_WORDS)) {
    if (trimmed.toLowerCase().startsWith(w)) return v;
  }
  const f = /^(\d+)\s*\/\s*(\d+)/.exec(trimmed);
  if (f?.[1] && f[2]) return parseInt(f[1], 10) / parseInt(f[2], 10);
  return parseFloat(trimmed.replace(",", ".")) || null;
}

export function parseWeight(text: string): WeightParseResult | null {
  const stdRe =
    /(\d+(?:[.,]\d+)?)\s*(kg|litr(?:[óo]w|a)?|ml|g|l\b|lb|lbs|pound|pounds|oz|ounce|ounces)/gi;
  let first: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = stdRe.exec(text)) !== null) {
    if (!first) first = m;
  }
  if (first?.[1] && first[2]) {
    let val = parseFloat(first[1].replace(",", "."));
    const unit = first[2].toLowerCase();
    if (unit === "kg") val *= 1000;
    if (unit.startsWith("litr") || unit === "l") val *= 1000;
    if (
      unit === "lb" ||
      unit === "lbs" ||
      unit === "pound" ||
      unit === "pounds"
    ) {
      val *= 454;
    }
    if (unit === "oz" || unit === "ounce" || unit === "ounces") val *= 28;
    const isVol = unit === "ml" || unit.startsWith("litr") || unit === "l";
    return {
      weight: Math.min(99999, Math.round(val)),
      unit: isVol ? "ml" : "g",
      matchIndex: first.index,
      matchEnd: first.index + first[0].length,
    };
  }

  for (const { re, g, ml } of ENGLISH_UNITS) {
    const unitM = re.exec(text);
    if (unitM) {
      const beforeUnit = text.slice(0, unitM.index).trim();
      const fracM =
        /(pół|half|quarter|ćwierć|\d+(?:[.,]\d+)?|\d+\/\d+)\s*$/i.exec(
          beforeUnit,
        );
      const count = fracM?.[1] ? (parseNum(fracM[1]) ?? 1) : 1;
      const perUnit = ml ?? g;
      const useMl = Boolean(ml);
      const nameBeforeUnit = beforeUnit
        .replace(
          /(pół|half|quarter|ćwierć|\d+(?:[.,]\d+)?|\d+\/\d+)\s*$/i,
          "",
        )
        .trim();
      const matchEnd = unitM.index + unitM[0].length;
      const afterUnit = text
        .slice(matchEnd)
        .trim()
        .split(/\s*[,(-]/)[0]
        ?.trim();
      const forcedName = nameBeforeUnit.length < 2 ? afterUnit : undefined;
      return {
        weight: Math.min(99999, Math.round(count * perUnit)),
        unit: useMl ? "ml" : "g",
        matchIndex: fracM ? unitM.index - fracM[0].length : unitM.index,
        matchEnd,
        forcedName,
      };
    }
  }

  for (const { re, g } of POLISH_UNITS) {
    const unitM = re.exec(text);
    if (unitM) {
      const beforeUnit = text.slice(0, unitM.index).trim();
      const fracM =
        /(pół|ćwierć|\d+(?:[.,]\d+)?|\d+\/\d+)\s*$/i.exec(beforeUnit);
      const count = fracM?.[1] ? (parseNum(fracM[1]) ?? 1) : 1;
      const nameBeforeUnit = beforeUnit
        .replace(/(pół|ćwierć|\d+(?:[.,]\d+)?|\d+\/\d+)\s*$/i, "")
        .trim();
      const matchEnd = unitM.index + unitM[0].length;
      const afterUnit = text
        .slice(matchEnd)
        .trim()
        .split(/\s*[,(-]/)[0]
        ?.trim();
      const forcedName = nameBeforeUnit.length < 2 ? afterUnit : undefined;
      return {
        weight: Math.min(99999, Math.round(count * g)),
        unit: "g",
        matchIndex: fracM ? unitM.index - fracM[0].length : unitM.index,
        matchEnd,
        forcedName,
      };
    }
  }

  const pieceM = PIECE_WORDS.exec(text);
  if (pieceM) {
    const before = text.slice(0, pieceM.index);
    const numBefore = /(\d+)\s*$/.exec(before.trim());
    const after = text.slice(pieceM.index + pieceM[0].length);
    const numAfter = /^\s*(\d+)\s*(szt\w*)?/i.exec(after);
    const count = numBefore?.[1]
      ? parseInt(numBefore[1], 10)
      : numAfter?.[1]
        ? parseInt(numAfter[1], 10)
        : 1;
    return {
      weight: count,
      unit: "szt",
      matchIndex: pieceM.index,
      matchEnd: pieceM.index + pieceM[0].length,
      forcedName: pieceM[0].toLowerCase(),
    };
  }

  const bareM = /^(\d+)\s+/.exec(text);
  if (bareM?.[1]) {
    return {
      weight: parseInt(bareM[1], 10),
      unit: "szt",
      matchIndex: 0,
      matchEnd: bareM[0].length,
      forcedName: null,
    };
  }

  return null;
}

const JUNK_PREFIX =
  /^[\d/.,\s]*(po\s+)?(pół|half|quarter|ćwierć|płask\w*|duż\w*|mał\w*|śwież\w*|ugotown\w*|młod\w*|klarowan\w*|słodk\w*|ostr\w*|fresh|grated|chopped|diced|minced|skinless|niepełn\w*|niepeln\w*|szczypt\w*|średni\w*|sredni\w*)?\s*/i;
const JUNK_SUFFIX =
  /\s*(duże?|małe?|świeże?|ugotowane?|na\s+twardo|można\s+pominąć|klarowanego?|optional|chopped|diced|minced|grated|skinless|fresh|i\s+\w.*)$/i;
const UNIT_WORDS =
  /\b(szklank\w+|łyżk\w+|łyżeczk\w+|pęczk\w+|garśc\w*|kostek?|kostki|kostkę|cups?|tablespoons?|teaspoons?|tbsp\.?|tsp\.?|pounds?|ounces?)\b\s*/gi;

function extractName(content: string, parsed: WeightParseResult): string {
  if (parsed.forcedName) return parsed.forcedName;
  let before = content.substring(0, parsed.matchIndex).trim();
  const dashIdx = before.lastIndexOf(" - ");
  if (dashIdx > 0) before = before.substring(0, dashIdx).trim();
  before = before
    .replace(JUNK_PREFIX, "")
    .replace(UNIT_WORDS, "")
    .replace(JUNK_SUFFIX, "")
    .trim();
  if (before.length >= 3) return before;
  return content
    .substring(parsed.matchEnd ?? parsed.matchIndex)
    .trim()
    .replace(/\s*[-,(].*$/, "")
    .replace(/\s+i\s+.*$/i, "")
    .replace(JUNK_PREFIX, "")
    .replace(UNIT_WORDS, "")
    .replace(JUNK_SUFFIX, "")
    .trim();
}

function parseSegments(content: string): ParsedRecipeIngredient[] {
  const clean = content.replace(/^[^:]+:\s*/, "").trim();
  const results: ParsedRecipeIngredient[] = [];
  const parsed = parseWeight(clean);
  if (!parsed) return results;
  const ingName = extractName(clean, parsed);
  if (ingName && ingName.length >= 2) {
    results.push({
      rawName: ingName,
      weight: parsed.weight,
      unit: parsed.unit,
      product_id: null,
    });
  }
  const afterUnit = clean.substring(parsed.matchEnd ?? parsed.matchIndex).trim();
  const andMatch = /\s+i\s+(\w+)/i.exec(afterUnit);
  if (andMatch?.[1] && andMatch[1].length >= 3) {
    results.push({
      rawName: andMatch[1],
      weight: parsed.weight,
      unit: parsed.unit,
      product_id: null,
    });
  }
  return results;
}

export function parseRecipeText(text: string): {
  name: string;
  ingredients: ParsedRecipeIngredient[];
} | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const firstLine = lines[0];
  if (!firstLine) return null;
  const name = firstLine.replace(/^#+\s*/, "").trim();
  const ingredients: ParsedRecipeIngredient[] = [];
  for (const line of lines.slice(1)) {
    if (line.includes("http")) continue;
    const content = line.replace(/^[-•*]\s*/, "").trim();
    const segments = content.includes(",")
      ? content.split(/,\s+/)
      : [content];
    for (const seg of segments) {
      for (const r of parseSegments(seg)) {
        ingredients.push({ ...r, product_id: null });
      }
    }
  }
  return { name, ingredients };
}

function resolveProductId(
  canonicalName: string,
  productId: number | string | null,
  products: Product[],
  ingUnit: string,
): number | null {
  if (!productId) return null;
  const id = typeof productId === "string" ? parseInt(productId, 10) : productId;
  const product = products.find((p) => p.id === id);
  return product &&
    productMatchesIngredient(canonicalName, product, ingUnit)
    ? id
    : null;
}

export function enrichIngredient(
  ing: ParsedRecipeIngredient,
  products: Product[],
): ParsedRecipeIngredient {
  const canonicalName = ing.canonicalName ?? canonicalizeIngredient(ing.rawName);
  const ingUnit = ing.unit || "g";
  const match = pickBestMatchingProduct(canonicalName, products, ingUnit);
  const product_id = ing.product_id
    ? resolveProductId(canonicalName, ing.product_id, products, ingUnit)
    : (match?.id ?? null);
  return {
    ...ing,
    canonicalName,
    unit: ingUnit,
    product_id: product_id ?? null,
  };
}

export function matchProducts(
  ingredients: ParsedRecipeIngredient[],
  products: Product[],
): ParsedRecipeIngredient[] {
  return ingredients.map((ing) => enrichIngredient(ing, products));
}

export function buildParsedFromText(
  text: string,
  products: Product[],
  prev: ParsedRecipe | null,
): ParsedRecipe | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const result = parseRecipeText(trimmed);
  if (!result) return null;
  const ingredients = matchProducts(result.ingredients, products);
  const base = { name: result.name, ingredients, sourceText: trimmed };
  if (!prev) {
    return { ...base, servings: "", category: null };
  }
  const prevByName = Object.fromEntries(
    prev.ingredients.map((ing) => [ing.rawName.toLowerCase(), ing]),
  );
  return {
    ...base,
    category: prev.category,
    servings: prev.servings,
    ingredients: ingredients.map((ing, i) => {
      const old =
        prevByName[ing.rawName.toLowerCase()] ?? prev.ingredients[i];
      if (!old) return ing;
      const canonicalName =
        ing.canonicalName ?? canonicalizeIngredient(ing.rawName);
      const keptProductId = old.product_id
        ? resolveProductId(
            canonicalName,
            old.product_id,
            products,
            ing.unit || "g",
          )
        : null;
      return {
        ...ing,
        product_id: keptProductId ?? ing.product_id,
        weight: old.weight ?? ing.weight,
        unit: old.unit ?? ing.unit,
      };
    }),
  };
}
