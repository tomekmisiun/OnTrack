const TYPO_FIX = {
  greck: 'grecki', grecka: 'grecka', drodny: 'drobny', drodna: 'drobna',
  tortow: 'tortowa', pszen: 'pszenna', mak: 'maka',
};

const PL_STEM = {
  soli: 'sol', sol: 'sol',
  maki: 'maka', mak: 'maka',
  mleka: 'mleko', mleko: 'mleko',
  oleju: 'olej', olej: 'olej',
  cukru: 'cukier', cukier: 'cukier',
  proszku: 'proszek', proszek: 'proszek',
  jajek: 'jajka', jajka: 'jajka', jajko: 'jajko',
  masla: 'maslo',
  drozdzy: 'drozdze', drozdz: 'drozdze',
  smietany: 'smietana', smietana: 'smietana',
  maka: 'maka',
};

const PL_ADJ_STEM = {
  pszennej: 'pszenna', pszenne: 'pszenna', pszenna: 'pszenna',
  tortowej: 'tortowa', tortowe: 'tortowa', tortowa: 'tortowa',
  razowej: 'razowa', razowe: 'razowa', razowa: 'razowa',
  pieczenia: 'pieczenie', pieczeniu: 'pieczenie',
};

export function stemIngredientWord(w) {
  const fixed = TYPO_FIX[w] || w;
  return PL_STEM[fixed] || PL_ADJ_STEM[fixed] || fixed;
}

export { TYPO_FIX };
