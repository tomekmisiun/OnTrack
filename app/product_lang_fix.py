"""Repair product names that leaked across PL/EN catalogs."""

from __future__ import annotations

import re
import unicodedata

from app import db
from app.models.product import Product
from app.models.recipe import RecipeIngredient

_PL_CHARS = re.compile(r"[ąćęłńóśźż]", re.I)

# Wrong name (lower) -> correct name for that lang
_RENAME_MAP: dict[str, dict[str, str]] = {
    "en": {
        "komosa ryżowa": "quinoa",
        "komosa ryzowa": "quinoa",
    },
    "pl": {},
}


def _norm(name: str) -> str:
    s = unicodedata.normalize("NFKD", (name or "").strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s)


def _looks_polish(name: str) -> bool:
    return bool(_PL_CHARS.search(name))


def fix_user_product_lang_names(
    user_id: int,
    lang: str | None = None,
    *,
    dry_run: bool = False,
) -> dict[str, int]:
    """
    Rename or merge products with wrong-language names.

    Returns counts: renamed, merged, skipped_unmapped.
    """
    langs = [lang] if lang else list(_RENAME_MAP.keys())
    renamed = merged = skipped = 0

    for lng in langs:
        rename_map = _RENAME_MAP.get(lng) or {}
        if not rename_map:
            continue

        for wrong_norm, correct_name in rename_map.items():
            wrong = Product.query.filter_by(user_id=user_id, lang=lng).all()
            wrong = next((p for p in wrong if _norm(p.name) == _norm(wrong_norm)), None)
            if not wrong:
                continue

            target = Product.query.filter_by(user_id=user_id, lang=lng).filter(
                db.func.lower(Product.name) == correct_name.lower()
            ).first()

            if target and target.id != wrong.id:
                if not dry_run:
                    RecipeIngredient.query.filter_by(product_id=wrong.id).update(
                        {RecipeIngredient.product_id: target.id},
                        synchronize_session=False,
                    )
                    db.session.delete(wrong)
                    db.session.commit()
                merged += 1
                continue

            if dry_run:
                renamed += 1
                continue

            wrong.name = correct_name
            db.session.commit()
            renamed += 1

        if lng == "en":
            mapped = {_norm(k) for k in rename_map}
            for p in Product.query.filter_by(user_id=user_id, lang="en").all():
                if _looks_polish(p.name) and _norm(p.name) not in mapped:
                    skipped += 1

    return {"renamed": renamed, "merged": merged, "skipped_unmapped": skipped}


def fix_all_users_product_lang_names(
    lang: str | None = None,
    *,
    dry_run: bool = False,
) -> dict[str, int]:
    """Run repair for every user that has products."""
    from app.models.user import User

    totals = {"renamed": 0, "merged": 0, "skipped_unmapped": 0, "users": 0}
    for user in User.query.all():
        counts = fix_user_product_lang_names(user.id, lang, dry_run=dry_run)
        if counts["renamed"] or counts["merged"]:
            totals["users"] += 1
        for k in ("renamed", "merged", "skipped_unmapped"):
            totals[k] += counts[k]
    return totals
