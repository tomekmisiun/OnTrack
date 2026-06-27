"""Macro lookup: generated catalog → AI cache → DeepSeek."""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import unicodedata

from rapidfuzz import fuzz, process

from app.core.catalog_data import canonical_products_path, load_json_list
from app.core.runtime_data import macro_ai_cache_path

_PL_TRANSLATE = str.maketrans("ąćęłńóśźż", "acelnoszz")
_CACHE_LOCK = threading.Lock()
_log = logging.getLogger(__name__)

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

_catalog_maps: dict[str, dict[str, dict]] | None = None
_ai_cache: dict[str, dict] | None = None


def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def dedup_key(name: str) -> str:
    s = strip_accents(name.lower().strip()).translate(_PL_TRANSLATE)
    s = s.replace("-", "")
    return re.sub(r"\s+", " ", s)


def _macro_value(item: dict) -> dict:
    return {
        "kcal": item.get("kcal"),
        "protein": item.get("protein_g"),
        "fat": item.get("fat_g"),
        "carbs": item.get("carbs_g"),
    }


def _load_ai_cache() -> dict[str, dict]:
    global _ai_cache
    if _ai_cache is not None:
        return _ai_cache
    path = macro_ai_cache_path()
    if path.exists():
        try:
            _ai_cache = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            _ai_cache = {}
    else:
        _ai_cache = {}
    return _ai_cache


def _save_ai_cache_entry(cache_key: str, payload: dict) -> None:
    with _CACHE_LOCK:
        cache = _load_ai_cache()
        cache[cache_key] = payload
        path = macro_ai_cache_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


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
    kcal = val.get("kcal")
    protein = val.get("protein")
    fat = val.get("fat")
    carbs = val.get("carbs")
    if not validate_macros(kcal, protein, fat, carbs):
        return None
    out = {
        "found": True,
        "source": source,
        "kcal": round(float(kcal), 1),
        "protein": round(float(protein or 0), 1),
        "fat": round(float(fat or 0), 1),
        "carbs": round(float(carbs or 0), 1),
    }
    if name:
        out["matched_name"] = name
    return out


def _build_catalog_map() -> dict[str, dict]:
    path = canonical_products_path()
    if not path.is_file():
        return {}
    items = load_json_list(path)
    result: dict[str, dict] = {}
    for item in items:
        macros = item.get("macros") or {}
        val = {
            "kcal": macros.get("kcal"),
            "protein": macros.get("protein"),
            "fat": macros.get("fat"),
            "carbs": macros.get("carbs"),
        }
        if not validate_macros(val["kcal"], val["protein"], val["fat"], val["carbs"]):
            continue
        names = item.get("names") or {}
        for locale in ("pl", "en"):
            name = (names.get(locale) or "").strip()
            if not name:
                continue
            result[name.lower()] = val
            result[dedup_key(name)] = val
    return result


def _get_catalog_map(_lang: str) -> dict[str, dict]:
    global _catalog_maps
    if _catalog_maps is None:
        _catalog_maps = {"all": _build_catalog_map()}
    return _catalog_maps["all"]


def _lookup_catalog(name: str, lang: str) -> dict | None:
    map_ = _get_catalog_map(lang)
    if not map_:
        return None
    key = dedup_key(name)
    hit = map_.get(name.lower()) or map_.get(key)
    if hit:
        return _normalize_result("catalog", hit, name)
    match = process.extractOne(
        name,
        map_.keys(),
        scorer=fuzz.partial_ratio,
        score_cutoff=88,
    )
    if match:
        matched_key, score, _ = match
        if score >= 88:
            return _normalize_result("catalog", map_[matched_key], matched_key)
    return None


def _lookup_ai_cache(name: str, lang: str) -> dict | None:
    cache = _load_ai_cache()
    entry = cache.get(f"{lang}:{dedup_key(name)}")
    if not entry:
        return None
    return _normalize_result("cache", entry, entry.get("name"))


def _parse_ai_json(content: str) -> dict | None:
    content = content.strip()
    content = re.sub(r"^```(?:json)?\s*", "", content)
    content = re.sub(r"\s*```$", "", content)
    parsed = json.loads(content)
    if isinstance(parsed, list) and parsed:
        return parsed[0]
    if isinstance(parsed, dict):
        for val in parsed.values():
            if isinstance(val, list) and val:
                return val[0]
    return None


def _deepseek_api_key() -> str:
    return os.environ.get("DEEPSEEK_API_KEY", "").strip()


def _openai_client():
    api_key = _deepseek_api_key()
    if not api_key:
        return None
    try:
        from openai import OpenAI
    except ImportError:
        _log.error("openai package is not installed; DeepSeek macro lookup disabled")
        return None
    return OpenAI(api_key=api_key, base_url="https://api.deepseek.com", timeout=30.0)


def _fetch_ai_macros(name: str, lang: str) -> dict | None:
    client = _openai_client()
    if client is None:
        return None

    system = _SYSTEM_PROMPT_PL if lang == "pl" else _SYSTEM_PROMPT_EN
    user_msg = json.dumps([name], ensure_ascii=False)

    try:
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.0,
        )
        item = _parse_ai_json(resp.choices[0].message.content or "")
    except Exception as exc:
        _log.warning("DeepSeek macro lookup failed for %r: %s", name, exc)
        return None

    if not item:
        return None

    val = _macro_value(item)
    normalized = _normalize_result("ai", val, name)
    if not normalized:
        return None

    cache_payload = {
        "name": name,
        "name_en": item.get("name_en"),
        "name_pl": item.get("name_pl"),
        **val,
    }
    _save_ai_cache_entry(f"{lang}:{dedup_key(name)}", cache_payload)
    return normalized


def lookup_macros(name: str, lang: str = "pl") -> dict:
    """Resolve macros for a product/ingredient name."""
    name = (name or "").strip()
    lang = "en" if (lang or "pl").lower().startswith("en") else "pl"
    if not name:
        return {"found": False, "error": "empty_name"}

    for resolver in (
        _lookup_catalog,
        _lookup_ai_cache,
        lambda n, lng: _fetch_ai_macros(n, lng),
    ):
        hit = resolver(name, lang)
        if hit:
            return hit

    if not _deepseek_api_key():
        return {"found": False, "error": "ai_not_configured"}
    try:
        import openai  # noqa: F401
    except ImportError:
        return {"found": False, "error": "ai_unavailable"}
    return {"found": False, "error": "not_found"}
