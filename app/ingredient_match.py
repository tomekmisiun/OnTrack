"""Strict ingredient ↔ product name matching (recipe import). Prefer no match over false positives."""

import re
import unicodedata


_ING_STOP = {
    # PL
    'oraz', 'lub', 'albo', 'duze', 'male', 'duzy', 'maly', 'okolo', 'bardzo',
    'swieze', 'ugotowane', 'posiekane', 'uniwersalnej', 'pelne',
    'typu', 'np', 'xxl', 'saszetka', 'saszetki', 'sztuki', 'sztuk', 'duza', 'chwila',
    # EN
    'and', 'or', 'very', 'large', 'big', 'small', 'little', 'about', 'approx', 'approximately',
    'roughly', 'whole', 'medium', 'extra', 'type', 'eg', 'pkg', 'package', 'packet', 'packets',
    'pieces', 'piece', 'taste', 'optional', 'chopped', 'diced', 'minced', 'grated', 'skinless',
    'fresh', 'sliced', 'peeled', 'boneless', 'trimmed', 'drained', 'rinsed', 'thawed',
}

_ING_QUALIFIERS = {
    # PL
    'slodka', 'slodki', 'slodkie', 'roslinny', 'roslinna', 'roslinne',
    'waniliowy', 'waniliowa', 'waniliowe',
    'wanilinowy', 'wanilinowa', 'wanilinowe',
    'naturalny', 'naturalna', 'naturalne',
    'drobny', 'drobna', 'drobne', 'mlody', 'mloda', 'mlode', 'swiezy', 'swieza', 'swieze',
    'grecki', 'grecka', 'greckie', 'malinowy', 'malinowa', 'malinowe',
    'bialy', 'biala', 'biale', 'brazowy', 'brazowa', 'brazowe',
    # EN
    'sweet', 'plant', 'based', 'vanilla', 'natural', 'fine', 'finely', 'young',
    'greek', 'raspberry', 'strawberry', 'chocolate', 'lemon', 'white', 'brown',
    'organic', 'vegan', 'dairy', 'free', 'unsalted', 'salted', 'virgin', 'extra',
    'frozen', 'smoked', 'roasted', 'toasted', 'ground', 'powdered', 'plain',
}


_PL_TRANS = str.maketrans({
    'ą': 'a', 'ę': 'e', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'ć': 'c', 'ł': 'l', 'ń': 'n',
})


def _norm(s: str) -> str:
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.translate(_PL_TRANS)


def _prod_words(text: str) -> list[str]:
    return [
        w for w in _norm(text).split()
        if len(w) >= 2 and w not in _ING_STOP and w not in _ING_QUALIFIERS
    ]


def _levenshtein(a: str, b: str) -> int:
    m, n = len(a), len(b)
    if m == 0:
        return n
    if n == 0:
        return m
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        row = [i]
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            row.append(min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost))
        prev = row
    return prev[n]


def _ing_words(text: str) -> list[str]:
    words = re.split(r'[\s,.()"\'\[\]-]+', _norm(text))
    return [
        w for w in words
        if len(w) >= 3 and not w[0].isdigit()
        and w not in _ING_STOP and w not in _ING_QUALIFIERS
    ]


def _words_match_strict(a: str, b: str) -> bool:
    if a == b:
        return True
    min_len = min(len(a), len(b))
    if min_len >= 5 and (a in b or b in a):
        return True
    if min_len >= 4:
        threshold = (min_len + 3) // 4
        return _levenshtein(a, b) <= threshold
    return False


def ingredient_matches_product(ingredient_text: str, product_name: str) -> bool:
    words = _ing_words(ingredient_text)
    if not words:
        return False

    prod_words = _prod_words(product_name)
    if not prod_words:
        return False

    primary = words[0]
    prod_norm = _norm(product_name)

    primary_ok = any(_words_match_strict(primary, pw) for pw in prod_words)
    primary_ok = primary_ok or (len(primary) >= 5 and primary in prod_norm)
    if not primary_ok:
        return False

    if len(words) == 1:
        return True

    matched = sum(
        1 for iw in words
        if any(_words_match_strict(iw, pw) for pw in prod_words)
    )
    if matched / len(words) >= 0.5:
        return True
    return _words_match_strict(prod_words[0], primary)
