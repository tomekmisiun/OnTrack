// Levenshtein distance — ile edycji (wstaw/usuń/zamień znak) dzieli dwa słowa
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

function prodWords(text) {
  return norm(text)
    .split(/\s+/)
    .filter(w => w.length >= 2 && !ING_STOP_WORDS.has(w) && !ING_QUALIFIERS.has(w));
}

/** Czy produkt sensownie pasuje do składnika z przepisu (strict — wolę brak niż fałszywe trafienie). */
export function ingredientMatchesProduct(ingredientText, productName) {
  const words = ingWords(ingredientText);
  if (!words.length) return false;

  const pWords = prodWords(productName);
  if (!pWords.length) return false;

  const primary = words[0];
  const prodNorm = norm(productName);

  const primaryOk = pWords.some(pw => wordsMatchStrict(primary, pw))
    || (primary.length >= 5 && prodNorm.includes(primary));
  if (!primaryOk) return false;

  if (words.length === 1) return true;

  const matched = words.filter(iw => pWords.some(pw => wordsMatchStrict(iw, pw))).length;
  if (matched / words.length >= 0.5) return true;

  return wordsMatchStrict(pWords[0], primary);
}

/** Wybierz najlepszy produkt — preferuj dokładne trafienie rzeczownika (np. cukier, nie odżywka). */
export function pickBestMatchingProduct(ingredientText, products) {
  const candidates = products.filter(p => ingredientMatchesProduct(ingredientText, p.name));
  if (!candidates.length) return null;
  const words = ingWords(ingredientText);
  if (!words.length) return null;
  const primary = words[0];
  const exact = candidates.find(p => prodWords(p.name).some(w => w === primary));
  if (exact) return exact;
  const starts = candidates.find(p => norm(p.name).startsWith(primary));
  if (starts) return starts;
  return candidates[0];
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
