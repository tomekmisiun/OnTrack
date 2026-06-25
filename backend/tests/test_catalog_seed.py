from app.domain.catalog_seed import expand_products_catalog, expand_recipes_catalog

SAMPLE_PRODUCTS = [
    {
        "key": "avocado",
        "names": {"pl": "awokado", "en": "avocado"},
        "markets": {
            "PL": {"price": 3.5, "package_weight": 200, "unit": "szt", "sold_by_weight": False},
            "GB": {"price": 0.8, "package_weight": 1, "unit": "szt", "sold_by_weight": False},
        },
        "macros": {"kcal": 160, "protein": 2, "fat": 15, "carbs": 9},
    }
]

SAMPLE_RECIPES = [
    {
        "source_url": "https://example.com/recipe",
        "names": {"pl": "Sałatka", "en": "Salad"},
        "category": "lunch",
        "ingredients": [
            {"names": {"pl": "awokado", "en": "avocado"}, "weight": 50},
        ],
    }
]


def test_expand_products_catalog_per_market_lang():
    pl = expand_products_catalog(SAMPLE_PRODUCTS, "pl")
    en = expand_products_catalog(SAMPLE_PRODUCTS, "en")
    assert len(pl) == 1
    assert pl[0]["name"] == "awokado"
    assert len(en) == 1
    assert en[0]["name"] == "avocado"


def test_expand_recipes_catalog_uses_lang_specific_ingredient_names():
    pl = expand_recipes_catalog(SAMPLE_RECIPES, "pl")
    en = expand_recipes_catalog(SAMPLE_RECIPES, "en")
    assert pl[0]["name"] == "Sałatka"
    assert pl[0]["ingredients"][0]["product_name"] == "awokado"
    assert en[0]["name"] == "Salad"
    assert en[0]["ingredients"][0]["product_name"] == "avocado"
