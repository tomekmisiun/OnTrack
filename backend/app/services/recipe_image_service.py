"""Pexels image lookup for recipes (ported from Flask app/pexels.py)."""

from __future__ import annotations

import json
from functools import lru_cache

import requests

from app.core.config import get_settings
from app.core.runtime_data import recipes_pl_paths

_FOOD_HINTS = frozenset({
    "food", "meal", "dish", "recipe", "salad", "soup", "stew", "bowl",
    "pasta", "chicken", "beef", "breakfast", "snack", "bake", "grill",
})


@lru_cache(maxsize=1)
def _pl_name_en_lookup() -> tuple[dict[str, str], dict[str, str]]:
    by_url: dict[str, str] = {}
    by_pl: dict[str, str] = {}
    for path in recipes_pl_paths():
        if not path.exists():
            continue
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        for row in rows:
            name_en = (row.get("name_en") or "").strip()
            if not name_en:
                continue
            url = (row.get("url") or row.get("source_url") or "").strip()
            name_pl = (row.get("name_pl") or row.get("name") or "").strip()
            if url:
                by_url[url] = name_en
            if name_pl:
                by_pl[name_pl.lower()] = name_en
    return by_url, by_pl


def english_name_for_recipe(
    recipe_name: str,
    source_url: str | None = None,
    lang: str | None = "pl",
) -> str | None:
    if lang and lang != "pl":
        return None
    by_url, by_pl = _pl_name_en_lookup()
    url = (source_url or "").strip()
    if url and url in by_url:
        return by_url[url]
    return by_pl.get((recipe_name or "").strip().lower())


def pexels_search_term(
    recipe_name: str,
    name_en: str | None = None,
    *,
    lang: str | None = "pl",
    source_url: str | None = None,
) -> str:
    if not name_en and lang == "pl":
        name_en = english_name_for_recipe(recipe_name, source_url, lang)
    base = (name_en or recipe_name or "").strip()
    if not base:
        return ""
    words = set(base.lower().split())
    if not words & _FOOD_HINTS:
        base = f"{base} food"
    return base


def fetch_pexels_image(search_term: str, api_key: str | None = None) -> str | None:
    key = api_key or get_settings().pexels_api_key
    if not key or not search_term:
        return None
    try:
        resp = requests.get(
            "https://api.pexels.com/v1/search",
            params={"query": search_term, "per_page": 5, "orientation": "landscape"},
            headers={"Authorization": key},
            timeout=8,
        )
        resp.raise_for_status()
        photos = resp.json().get("photos") or []
        if photos:
            return photos[0]["src"]["medium"]
    except Exception:
        return None
    return None


def resolve_recipe_image(recipe, *, locale: str = "pl") -> str | None:
    from app.services.catalog_resolver import resolve_recipe

    resolved = resolve_recipe(recipe, locale=locale)
    term = pexels_search_term(
        resolved.name,
        lang=locale,
        source_url=recipe.source_url,
    )
    if locale == "pl" and not english_name_for_recipe(
        resolved.name, recipe.source_url, locale
    ):
        gemini_key = get_settings().gemini_api_key
        if gemini_key:
            try:
                from google import genai

                client = genai.Client(api_key=gemini_key)
                resp = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=(
                        f"Translate this Polish dish name to 1-4 English words suitable for "
                        f"food photo search: '{resolved.name}'. Reply with English words only."
                    ),
                )
                term = pexels_search_term(resp.text.strip(), lang="en")
            except Exception:
                pass
    return fetch_pexels_image(term)
