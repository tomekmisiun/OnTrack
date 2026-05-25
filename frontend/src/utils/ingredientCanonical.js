import { norm, ingredientWordsForMatch as ingWords } from './search';

const TYPO_FIX = {
  greck: 'grecki', grecka: 'grecka', drodny: 'drobny', drodna: 'drobna',
  tortow: 'tortowa', pszen: 'pszenna',
};

const PL_DISPLAY = {
  maka: 'mąka', maslo: 'masło', cukier: 'cukier', jajka: 'jajka', jajko: 'jajko',
  olej: 'olej', mleko: 'mleko', jogurt: 'jogurt', kisiel: 'kisiel', rabarbar: 'rabarbar',
  sol: 'sól', smietana: 'śmietana', drozdze: 'drożdże',
};

const KEEP_PAIR = {
  maka: new Set(['pszenna', 'pszenne', 'tortowa', 'tortowe', 'razowa', 'razowy']),
  mleko: new Set(['krowie', 'kokosowe', 'owsiane']),
  jogurt: new Set(['grecki', 'grecka', 'naturalny', 'naturalna']),
};

function displayWord(w) {
  return PL_DISPLAY[w] || w;
}

/** Wyciąga generyczną nazwę składnika do dopasowania (bez marek, opakowań, przymiotników). */
export function canonicalizeIngredient(rawName) {
  if (!rawName?.trim()) return '';

  let s = rawName.trim();
  s = s.replace(/\s*typu\s+["'«][^"'»]+["'»]/gi, '');
  s = s.replace(/\s*np\.?\s+[\wąćęłńóśźż-]+/gi, '');
  s = s.replace(/\s*\d+\s*(saszetk\w*|opakow\w*)\w*/gi, '');
  s = s.replace(/\bxxl\b/gi, '');
  s = s.replace(/["'«»]/g, ' ');
  s = s.replace(/\s*-\s*$/, '');
  s = s.replace(/\s+/g, ' ').trim();

  const words = ingWords(s).map(w => TYPO_FIX[w] || w);
  if (!words.length) return rawName.trim();

  const pair = KEEP_PAIR[words[0]];
  if (pair && words[1] && pair.has(words[1])) {
    return `${displayWord(words[0])} ${words[1]}`;
  }

  return displayWord(words[0]);
}

export function canonicalDiffersFromRaw(rawName, canonicalName) {
  if (!canonicalName || !rawName) return false;
  return norm(canonicalName) !== norm(rawName) && !norm(rawName).includes(norm(canonicalName));
}
