// Levenshtein distance — ile edycji (wstaw/usuń/zamień znak) dzieli dwa słowa
import { stemIngredientWord } from './ingredientStem';

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}

// Normalizacja: małe litery + polskie diakrytyki → łacina
export function norm(s) {
  return s.toLowerCase()
    .replace(/ą/g, 'a').replace(/ę/g, 'e').replace(/ó/g, 'o')
    .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
    .replace(/ć/g, 'c').replace(/ł/g, 'l').replace(/ń/g, 'n');
}

const ING_STOP_WORDS = new Set([
  // PL — słowa przygotowania / szum
  'oraz', 'lub', 'albo', 'duze', 'male', 'duzy', 'maly', 'okolo', 'bardzo',
  'swieze', 'ugotowane', 'posiekane', 'uniwersalnej', 'pelne',
  'niepelne', 'niepelna', 'niepelny', 'nepelne', 'nepelna',
  'szczypta', 'srednie', 'srednia', 'sredni', 'srednich',
  'pol', 'polowa', 'polowe', 'niepelnych',
  'typu', 'np', 'xxl', 'saszetka', 'saszetki', 'sztuki', 'sztuk', 'duza', 'chwila',
  // EN — prep words / noise
  'and', 'or', 'very', 'large', 'big', 'small', 'little', 'about', 'approx', 'approximately',
  'roughly', 'whole', 'medium', 'extra', 'type', 'eg', 'pkg', 'package', 'packet', 'packets',
  'pieces', 'piece', 'taste', 'optional', 'chopped', 'diced', 'minced', 'grated', 'skinless',
  'fresh', 'sliced', 'peeled', 'boneless', 'trimmed', 'drained', 'rinsed', 'thawed',
]);

// Przymiotniki / smaki — nie mogą same decydować o dopasowaniu
const ING_QUALIFIERS = new Set([
  // PL
  'slodka', 'slodki', 'slodkie', 'roslinny', 'roslinna', 'roslinne',
  'waniliowy', 'waniliowa', 'waniliowe',
  'wanilinowy', 'wanilinowa', 'wanilinowe',
  'naturalny', 'naturalna', 'naturalne',
  'drobny', 'drobna', 'drobne', 'mlody', 'mloda', 'mlode', 'swiezy', 'swieza', 'swieze',
  'grecki', 'grecka', 'greckie', 'malinowy', 'malinowa', 'malinowe',
  'bialy', 'biala', 'biale', 'brazowy', 'brazowa', 'brazowe',
  // EN
  'sweet', 'plant', 'based', 'vanilla', 'natural', 'fine', 'finely', 'young',
  'greek', 'raspberry', 'strawberry', 'chocolate', 'lemon', 'white', 'brown',
  'organic', 'vegan', 'dairy', 'free', 'unsalted', 'salted', 'virgin', 'extra',
  'frozen', 'smoked', 'roasted', 'toasted', 'ground', 'powdered', 'plain',
]);

function ingWords(text) {
  return norm(text)
    .split(/[\s,.()"'\[\]-]+/)
    .filter(w => w.length >= 3 && !/^\d/.test(w) && !ING_STOP_WORDS.has(w) && !ING_QUALIFIERS.has(w));
}

export { ingWords as ingredientWordsForMatch };

function wordsMatchStrict(a, b) {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 5 && (a.includes(b) || b.includes(a))) return true;
  if (minLen >= 4) {
    const threshold = Math.ceil(minLen / 4);
    return levenshtein(a, b) <= threshold;
  }
  return false;
}

/** Dopasowanie głównego rzeczownika — max 1 literówka, ten sam początek słowa. */
function wordsMatchPrimary(a, b) {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 4) return false;
  if (a.slice(0, 3) !== b.slice(0, 3)) return false;
  if ((a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2) {
    return true;
  }
  return levenshtein(a, b) <= 1;
}

function matchWords(text) {
  return ingWords(text).map(stemIngredientWord);
}

function prodWords(text) {
  return norm(text)
    .split(/\s+/)
    .filter(w => w.length >= 2 && !ING_STOP_WORDS.has(w) && !ING_QUALIFIERS.has(w));
}

/** Rodzina jednostki: objętość (ml/l), masa (g/kg), sztuki. */
export function unitFamily(unit) {
  const u = (unit || 'g').toLowerCase();
  if (u === 'ml' || u === 'l') return 'volume';
  if (u === 'szt') return 'piece';
  return 'mass';
}

/** Czy jednostka składnika z przepisu pasuje do produktu w bazie (mleko 375 ml ≠ mięta w g). */
export function unitsCompatible(ingUnit, product) {
  const ingFam = unitFamily(ingUnit);
  if (product.sold_by_weight) return ingFam === 'mass';
  return ingFam === unitFamily(product.unit);
}

/** Czy produkt sensownie pasuje do składnika z przepisu (strict — wolę brak niż fałszywe trafienie). */
export function ingredientMatchesProduct(ingredientText, productName) {
  const words = matchWords(ingredientText);
  if (!words.length) return false;

  const pWords = prodWords(productName).map(stemIngredientWord);
  if (!pWords.length) return false;

  const primary = words[0];
  if (!wordsMatchPrimary(primary, pWords[0])) return false;

  if (words.length === 1) return true;

  const restIng = words.slice(1);
  const restProd = pWords.slice(1);
  if (!restProd.length) return true;

  return restIng.every(iw => restProd.some(pw => wordsMatchPrimary(iw, pw) || iw === pw));
}

/** Nazwa + jednostka — pełna weryfikacja dopasowania składnik ↔ produkt. */
export function productMatchesIngredient(ingredientText, product, ingUnit = 'g') {
  if (!unitsCompatible(ingUnit, product)) return false;
  return ingredientMatchesProduct(ingredientText, product.name);
}

function scoreProductMatch(words, productName) {
  const pWords = prodWords(productName).map(stemIngredientWord);
  if (!pWords.length) return -1;

  let score = 0;
  if (pWords[0] === words[0]) score += 100;
  else if (wordsMatchPrimary(words[0], pWords[0])) score += 50;
  else return -1;

  for (let i = 1; i < words.length; i++) {
    if (pWords.length === 1) break;
    if (restProdHas(pWords, words[i])) score += 20;
    else return -1;
  }

  if (pWords.length === words.length) score += 10;
  score -= (pWords.length - 1) * 5;
  return score;
}

function restProdHas(pWords, word) {
  return pWords.slice(1).some(pw => pw === word || wordsMatchPrimary(word, pw));
}

/** Wybierz najlepszy produkt — preferuj dokładne trafienie rzeczownika (np. cukier, nie curry). */
export function pickBestMatchingProduct(ingredientText, products, ingUnit = 'g') {
  const words = matchWords(ingredientText);
  if (!words.length) return null;

  let best = null;
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

/**
 * Fuzzy search — zwraca true jeśli text "pasuje" do query nawet z literówkami.
 *
 * Logika:
 * 1. Exact substring match (najszybsza ścieżka)
 * 2. Dla każdego słowa z query (≥4 znaki): szuka słowa w tekście
 *    z odległością Levenshteina ≤ ceil(długość/4)
 *    → "chixen"(6) → próg 2 → pasuje do "chicken" (dystans 2) ✓
 *    → "chick" (5) → próg 2 → pasuje do "chicken" (dystans 2) ✓
 * 3. Krótkie słowa (<4 znaki) muszą pasować dokładnie (za małe żeby fuzzować)
 */
export function fuzzySearch(query, text) {
  if (!query) return true;
  const q = norm(query.trim());
  const t = norm(text);

  if (t.includes(q)) return true;

  const qWords = q.split(/\s+/).filter(Boolean);
  const tWords = t.split(/\s+/).filter(Boolean);

  return qWords.every(qw => {
    if (qw.length < 4) return t.includes(qw);
    const threshold = Math.ceil(qw.length / 4);
    return tWords.some(tw => levenshtein(qw, tw) <= threshold);
  });
}
