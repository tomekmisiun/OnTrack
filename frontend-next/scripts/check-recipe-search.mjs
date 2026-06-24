import { strict as assert } from "node:assert";

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}

function norm(s) {
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

function fuzzySearch(query, text) {
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

const PIECE_WORDS =
  /jajk[ao]|jajek|jaja?(?=\s)|jaj\b|sztuk[ia]?|szt\.?|\beggs?\b|\bcloves?\b|\bonions?\b|\bpieces?\b|\bpcs\b/i;

function parseWeight(text) {
  const stdRe =
    /(\d+(?:[.,]\d+)?)\s*(kg|litr(?:[óo]w|a)?|ml|g|l\b|lb|lbs|pound|pounds|oz|ounce|ounces)/gi;
  let first = null;
  let m;
  while ((m = stdRe.exec(text)) !== null) {
    if (!first) first = m;
  }
  if (first) {
    let val = parseFloat(first[1].replace(",", "."));
    const unit = first[2].toLowerCase();
    if (unit === "kg") val *= 1000;
    if (unit.startsWith("litr") || unit === "l") val *= 1000;
    const isVol = unit === "ml" || unit.startsWith("litr") || unit === "l";
    return {
      weight: Math.min(99999, Math.round(val)),
      unit: isVol ? "ml" : "g",
      matchIndex: first.index,
      matchEnd: first.index + first[0].length,
    };
  }
  const pieceM = PIECE_WORDS.exec(text);
  if (pieceM) {
    const before = text.slice(0, pieceM.index);
    const numBefore = /(\d+)\s*$/.exec(before.trim());
    const after = text.slice(pieceM.index + pieceM[0].length);
    const numAfter = /^\s*(\d+)\s*(szt\w*)?/i.exec(after);
    const count = numBefore
      ? parseInt(numBefore[1], 10)
      : numAfter
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
  return null;
}

function parseRecipeText(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const name = lines[0].replace(/^#+\s*/, "").trim();
  const ingredients = [];
  for (const line of lines.slice(1)) {
    if (line.includes("http")) continue;
    const content = line.replace(/^[-•*]\s*/, "").trim();
    const parsed = parseWeight(content);
    if (!parsed) continue;
    const before = content.substring(0, parsed.matchIndex).trim();
    const ingName =
      parsed.forcedName ||
      before.replace(/^[\d/.,\s]*/, "").trim() ||
      content.substring(parsed.matchEnd).trim().split(/\s*[,(-]/)[0];
    if (ingName && ingName.length >= 2) {
      ingredients.push({
        rawName: ingName,
        weight: parsed.weight,
        unit: parsed.unit,
      });
    }
  }
  return { name, ingredients };
}

assert.equal(fuzzySearch("", "anything"), true);
assert.equal(fuzzySearch("chicken", "Chicken soup"), true);
assert.equal(fuzzySearch("chixen", "chicken soup"), true);
assert.equal(fuzzySearch("xyzabc", "chicken soup"), false);

const parsed = parseRecipeText(
  "Omlet\nJajka - 3 szt\nMleko - 200 ml\nSól - szczypta",
);
assert.ok(parsed);
assert.equal(parsed.name, "Omlet");
assert.ok(parsed.ingredients.length >= 2);
assert.equal(parsed.ingredients[0]?.rawName.toLowerCase(), "jajka");
assert.equal(parsed.ingredients[0]?.unit, "szt");

const empty = parseRecipeText("   \n  ");
assert.equal(empty, null);

console.log("recipe search helpers: ok");
