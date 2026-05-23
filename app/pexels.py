"""Fetch recipe thumbnail images from the Pexels API."""

from __future__ import annotations

import os
import time

import requests

from app.recipe_catalog import english_name_for_recipe

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
    """
    Build a food-focused English query for Pexels.

    PL recipes: prefer pipeline name_en (from recipes_pl.json), matched by
    source_url or PL title — not the displayed Polish name alone.
    """
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
    """Prefer Pexels when configured; otherwise use the source recipe thumbnail."""
    term = pexels_search_term(
        recipe_name, name_en, lang=lang, source_url=source_url,
    )
    url = fetch_pexels_image(term, api_key)
    if url:
        return url
    if fallback_url:
        return fallback_url
    return None


def apply_pexels_to_user_recipes(
    user_id: int,
    lang: str | None = None,
    *,
    replace_all: bool = False,
    dry_run: bool = False,
    sleep_s: float = 0.25,
) -> tuple[int, int, int]:
    """
    Set recipe.image_url from Pexels for one user.

    Returns (updated, failed, skipped).
    """
    from app import db
    from app.models.recipe import Recipe

    query = Recipe.query.filter_by(user_id=user_id)
    if lang:
        query = query.filter_by(lang=lang)

    updated = failed = skipped = 0
    for recipe in query.all():
        if not replace_all and recipe.image_url and not is_source_recipe_image(recipe.image_url):
            skipped += 1
            continue

        term = pexels_search_term(
            recipe.name,
            lang=recipe.lang,
            source_url=recipe.source_url,
        )
        url = fetch_pexels_image(term)
        if url:
            if not dry_run:
                recipe.image_url = url
            updated += 1
        else:
            failed += 1

        if sleep_s:
            time.sleep(sleep_s)

    if not dry_run and updated:
        db.session.commit()

    return updated, failed, skipped
