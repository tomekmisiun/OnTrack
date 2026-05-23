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
function norm(s) {
  return s.toLowerCase()
    .replace(/ą/g, 'a').replace(/ę/g, 'e').replace(/ó/g, 'o')
    .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
    .replace(/ć/g, 'c').replace(/ł/g, 'l').replace(/ń/g, 'n');
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
