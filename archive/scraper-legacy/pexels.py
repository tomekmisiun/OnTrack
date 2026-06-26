"""Fetch recipe thumbnail images from the Pexels API (scraper pipeline)."""

from __future__ import annotations

import os

import requests

from recipe_catalog import english_name_for_recipe

SOURCE_IMAGE_DOMAINS = ("mealpreponfleek.com",)

_FOOD_HINTS = frozenset({
    "food", "meal", "dish", "recipe", "salad", "soup", "stew", "bowl",
    "pasta", "chicken", "beef", "breakfast", "snack", "bake", "grill",
})


def is_source_recipe_image(url: str | None) -> bool:
    if not url:
        return False
    return any(domain in url for domain in SOURCE_IMAGE_DOMAINS)


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
    key = api_key or os.environ.get("PEXELS_API_KEY")
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


def resolve_recipe_image_url(
    recipe_name: str,
    *,
    name_en: str | None = None,
    lang: str | None = "pl",
    source_url: str | None = None,
    fallback_url: str | None = None,
    api_key: str | None = None,
) -> str | None:
    term = pexels_search_term(
        recipe_name, name_en, lang=lang, source_url=source_url,
    )
    url = fetch_pexels_image(term, api_key)
    if url:
        return url
    return fallback_url
