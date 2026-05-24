import sys

import pytest

sys.path.insert(0, "/app/scraper")
from processing.import_to_db import canonical_ingredient_name  # noqa: E402

from app import db
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient
from app.product_lang_fix import fix_user_product_lang_names


def test_en_quinoa_stays_english():
    assert canonical_ingredient_name("quinoa", "en") == "quinoa"
    assert canonical_ingredient_name("quinoa pasta", "en") == "quinoa pasta"


def test_pl_quinoa_becomes_komosa():
    assert canonical_ingredient_name("quinoa", "pl") == "komosa ryżowa"


def test_fix_renames_komosa_to_quinoa_in_en_catalog(user):
    user.lang = "en"
    db.session.commit()
    p = Product(
        user_id=user.id,
        name="komosa ryżowa",
        price=0.396,
        package_weight=250,
        unit="g",
        lang="en",
        kcal=120,
    )
    db.session.add(p)
    db.session.commit()

    counts = fix_user_product_lang_names(user.id, lang="en")
    assert counts["renamed"] == 1

    fixed = Product.query.filter_by(user_id=user.id, lang="en").all()
    assert len(fixed) == 1
    assert fixed[0].name == "quinoa"


def test_fix_merges_duplicate_when_quinoa_already_exists(user):
    user.lang = "en"
    db.session.commit()
    good = Product(user_id=user.id, name="quinoa", price=0.4, package_weight=250, unit="g", lang="en")
    bad = Product(user_id=user.id, name="komosa ryżowa", price=0.4, package_weight=250, unit="g", lang="en")
    db.session.add_all([good, bad])
    db.session.flush()

    recipe = Recipe(name="Salad", user_id=user.id, lang="en")
    db.session.add(recipe)
    db.session.flush()
    db.session.add(RecipeIngredient(recipe_id=recipe.id, product_id=bad.id, weight=50))
    db.session.commit()

    counts = fix_user_product_lang_names(user.id, lang="en")
    assert counts["merged"] == 1

    assert Product.query.filter_by(user_id=user.id, lang="en", name="komosa ryżowa").first() is None
    ing = RecipeIngredient.query.filter_by(recipe_id=recipe.id).first()
    assert ing.product_id == good.id
