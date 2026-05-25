"""Extract generic ingredient name from recipe text (strip brands, packaging, adjectives)."""

import re

from app.utils.ingredient_match import _ing_words, _norm


_TYPO_FIX = {
    'greck': 'grecki', 'grecka': 'grecka', 'drodny': 'drobny', 'drodna': 'drobna',
}

_PL_DISPLAY = {
    'maka': 'mąka', 'maslo': 'masło', 'cukier': 'cukier', 'jajka': 'jajka', 'jajko': 'jajko',
    'olej': 'olej', 'mleko': 'mleko', 'jogurt': 'jogurt', 'kisiel': 'kisiel', 'rabarbar': 'rabarbar',
    'sol': 'sól', 'smietana': 'śmietana', 'drozdze': 'drożdże',
}

_KEEP_PAIR = {
    'maka': {'pszenna', 'pszenne', 'tortowa', 'tortowe', 'razowa', 'razowy'},
    'mleko': {'krowie', 'kokosowe', 'owsiane'},
    'jogurt': {'grecki', 'grecka', 'naturalny', 'naturalna'},
}


def _display(w: str) -> str:
    return _PL_DISPLAY.get(w, w)


def canonicalize_ingredient(raw_name: str) -> str:
    if not raw_name or not raw_name.strip():
        return ''

    s = raw_name.strip()
    s = re.sub(r'\s*typu\s+["\'«][^"\'»]+["\'»]', '', s, flags=re.I)
    s = re.sub(r'\s*np\.?\s+[\wąćęłńóśźż-]+', '', s, flags=re.I)
    s = re.sub(r'\s*\d+\s*(saszetk\w*|opakow\w*)\w*', '', s, flags=re.I)
    s = re.sub(r'\bxxl\b', '', s, flags=re.I)
    s = re.sub(r'["\'«»]', ' ', s)
    s = re.sub(r'\s*-\s*$', '', s)
    s = re.sub(r'\s+', ' ', s).strip()

    words = [_TYPO_FIX.get(w, w) for w in _ing_words(s)]
    if not words:
        return raw_name.strip()

    pair = _KEEP_PAIR.get(words[0])
    if pair and len(words) > 1 and words[1] in pair:
        return f'{_display(words[0])} {words[1]}'

    return _display(words[0])
