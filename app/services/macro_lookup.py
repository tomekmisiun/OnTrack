"""Macro lookup: local ingredient DB → AI cache → DeepSeek."""

from __future__ import annotations

import json
import os
import re
import threading
import unicodedata
from pathlib import Path

from rapidfuzz import fuzz, process

_APP_ROOT = Path(__file__).resolve().parents[1]
_REPO_ROOT = _APP_ROOT.parent
_MACROS_PATHS = (
    _APP_ROOT / 'data' / 'ingredients_macros.json',
    _REPO_ROOT / 'scraper' / 'data' / 'ingredients_macros.json',
)
_AI_CACHE_PATH = _APP_ROOT / 'data' / 'macro_ai_cache.json'

_PL_TRANSLATE = str.maketrans('ąćęłńóśźż', 'acelnoszz')
_CACHE_LOCK = threading.Lock()

_SYSTEM_PROMPT_EN = """\
Return macronutrients per 100g or 100ml of the raw/basic culinary form of the ingredient.
Return ONLY a valid JSON array with one object, no markdown:
[{
  "name_en": string,
  "name_pl": string,
  "kcal": number,
  "protein_g": number,
  "fat_g": number,
  "carbs_g": number
}]
Use USDA-style reference values for raw ingredients (not branded packaged products).
Round to 1 decimal. name_pl in Polish mianownik (nominative).
"""

_SYSTEM_PROMPT_PL = """\
Podaj makroskładniki na 100 g lub 100 ml surowej/podstawowej formy kulinarnej składnika.
Zwróć TYLKO poprawną tablicę JSON z jednym obiektem, bez markdownu:
[{
  "name_en": string,
  "name_pl": string,
  "kcal": number,
  "protein_g": number,
  "fat_g": number,
  "carbs_g": number
}]
Użyj wartości referencyjnych USDA dla surowych składników (nie produktów markowych).
Zaokrąglij do 1 miejsca po przecinku. name_pl w mianowniku.
"""

_macro_map_pl: dict[str, dict] | None = None
_macro_map_en: dict[str, dict] | None = None
_ai_cache: dict[str, dict] | None = None


def strip_accents(text: str) -> str:
    return ''.join(
        c for c in unicodedata.normalize('NFKD', text)
        if not unicodedata.combining(c)
    )


def dedup_key(name: str) -> str:
    s = strip_accents(name.lower().strip()).translate(_PL_TRANSLATE)
    s = s.replace('-', '')
    return re.sub(r'\s+', ' ', s)


def _macro_value(item: dict) -> dict:
    return {
        'kcal': item.get('kcal'),
        'protein': item.get('protein_g'),
        'fat': item.get('fat_g'),
        'carbs': item.get('carbs_g'),
    }


def _load_macros_file() -> list[dict]:
    for path in _MACROS_PATHS:
        if path.exists():
            return json.loads(path.read_text(encoding='utf-8'))
    return []


def _build_macro_map(key: str) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for item in _load_macros_file():
        name = item.get(key)
        if not name:
            continue
        val = _macro_value(item)
        if not val.get('kcal'):
            continue
        result[name] = val
        result[dedup_key(name)] = val
    return result


def _get_macro_maps() -> tuple[dict[str, dict], dict[str, dict]]:
    global _macro_map_pl, _macro_map_en
    if _macro_map_pl is None:
        _macro_map_pl = _build_macro_map('name_pl')
        _macro_map_en = _build_macro_map('name_en')
    return _macro_map_pl, _macro_map_en


def _load_ai_cache() -> dict[str, dict]:
    global _ai_cache
    if _ai_cache is not None:
        return _ai_cache
    if _AI_CACHE_PATH.exists():
        try:
            _ai_cache = json.loads(_AI_CACHE_PATH.read_text(encoding='utf-8'))
        except Exception:
            _ai_cache = {}
    else:
        _ai_cache = {}
    return _ai_cache


def _save_ai_cache_entry(cache_key: str, payload: dict) -> None:
    with _CACHE_LOCK:
        cache = _load_ai_cache()
        cache[cache_key] = payload
        _AI_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        _AI_CACHE_PATH.write_text(
            json.dumps(cache, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )


def validate_macros(kcal, protein, fat, carbs) -> bool:
    try:
        kcal = float(kcal)
        protein = float(protein or 0)
        fat = float(fat or 0)
        carbs = float(carbs or 0)
    except (TypeError, ValueError):
        return False
    if kcal < 0 or kcal > 900:
        return False
    for val in (protein, fat, carbs):
        if val < 0 or val > 100:
            return False
    estimated = protein * 4 + fat * 9 + carbs * 4
    if kcal > 0 and estimated > 0:
        ratio = kcal / estimated
        if ratio < 0.7 or ratio > 1.35:
            return False
    return True


def _normalize_result(source: str, val: dict, name: str | None = None) -> dict | None:
    kcal = val.get('kcal')
    protein = val.get('protein')
    fat = val.get('fat')
    carbs = val.get('carbs')
    if not validate_macros(kcal, protein, fat, carbs):
        return None
    out = {
        'found': True,
        'source': source,
        'kcal': round(float(kcal), 1),
        'protein': round(float(protein or 0), 1),
        'fat': round(float(fat or 0), 1),
        'carbs': round(float(carbs or 0), 1),
    }
    if name:
        out['matched_name'] = name
    return out


def _lookup_local(name: str, lang: str) -> dict | None:
    macro_pl, macro_en = _get_macro_maps()
    primary = macro_pl if lang == 'pl' else macro_en
    secondary = macro_en if lang == 'pl' else macro_pl
    key = dedup_key(name)

    for map_, label in ((primary, lang), (secondary, 'en' if lang == 'pl' else 'pl')):
        hit = map_.get(name.lower()) or map_.get(key)
        if hit:
            return _normalize_result('database', hit, name)
        match = process.extractOne(
            name,
            map_.keys(),
            scorer=fuzz.partial_ratio,
            score_cutoff=88,
        )
        if match:
            matched_key, score, _ = match
            if score >= 88:
                return _normalize_result('database', map_[matched_key], matched_key)
    return None


def _lookup_ai_cache(name: str, lang: str) -> dict | None:
    cache = _load_ai_cache()
    entry = cache.get(f'{lang}:{dedup_key(name)}')
    if not entry:
        return None
    return _normalize_result('cache', entry, entry.get('name'))


def _parse_ai_json(content: str) -> dict | None:
    content = content.strip()
    content = re.sub(r'^```(?:json)?\s*', '', content)
    content = re.sub(r'\s*```$', '', content)
    parsed = json.loads(content)
    if isinstance(parsed, list) and parsed:
        return parsed[0]
    if isinstance(parsed, dict):
        for val in parsed.values():
            if isinstance(val, list) and val:
                return val[0]
    return None


def _fetch_ai_macros(name: str, lang: str) -> dict | None:
    api_key = os.environ.get('DEEPSEEK_API_KEY', '').strip()
    if not api_key:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        return None

    client = OpenAI(api_key=api_key, base_url='https://api.deepseek.com')
    system = _SYSTEM_PROMPT_PL if lang == 'pl' else _SYSTEM_PROMPT_EN
    user_msg = json.dumps([name], ensure_ascii=False)

    try:
        resp = client.chat.completions.create(
            model='deepseek-chat',
            messages=[
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': user_msg},
            ],
            temperature=0.0,
        )
        item = _parse_ai_json(resp.choices[0].message.content or '')
    except Exception:
        return None

    if not item:
        return None

    val = _macro_value(item)
    normalized = _normalize_result('ai', val, name)
    if not normalized:
        return None

    cache_payload = {
        'name': name,
        'name_en': item.get('name_en'),
        'name_pl': item.get('name_pl'),
        **val,
    }
    _save_ai_cache_entry(f'{lang}:{dedup_key(name)}', cache_payload)
    return normalized


def lookup_macros(name: str, lang: str = 'pl') -> dict:
    """Resolve macros for a product/ingredient name."""
    name = (name or '').strip()
    lang = 'en' if (lang or 'pl').lower().startswith('en') else 'pl'
    if not name:
        return {'found': False, 'error': 'empty_name'}

    for resolver in (_lookup_local, _lookup_ai_cache, lambda n, l: _fetch_ai_macros(n, l)):
        hit = resolver(name, lang)
        if hit:
            return hit

    if not os.environ.get('DEEPSEEK_API_KEY', '').strip():
        return {'found': False, 'error': 'ai_not_configured'}
    return {'found': False, 'error': 'not_found'}
