from app import db
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient

DEFAULT_PRODUCTS = [
    # Nabiał
    ("Mleko",              1000, "ml"), ("Jogurt naturalny",   400, "g"),
    ("Jogurt naturalny",   200,  "g"), ("Twaróg",             200, "g"),
    ("Twaróg",             250,  "g"), ("Ser żółty",          150, "g"),
    ("Ser żółty",          1000, "g"), ("Masło",              200, "g"),
    ("Śmietana 18%",       200,  "ml"), ("Śmietana 18%",      400, "ml"),
    ("Śmietanka 30%",      200,  "ml"), ("Śmietanka 30%",     400, "ml"),
    ("Kefir",              500,  "ml"), ("Skyr",              150, "g"),
    ("Jajka",              10,   "szt"),
    # Zboża
    ("Płatki owsiane",    1000,  "g"), ("Ryż",               1000, "g"),
    ("Ryż",                400,  "g"), ("Makaron",            400, "g"),
    ("Kasza gryczana",     400,  "g"), ("Kasza gryczana",    1000, "g"),
    ("Kasza jaglana",      400,  "g"), ("Kasza jaglana",     1000, "g"),
    ("Kasza bulgur",       400,  "g"), ("Kasza bulgur",      1000, "g"),
    ("Quinoa",             400,  "g"), ("Mąka pszenna",      1000, "g"),
    ("Chleb",              500,  "g"),
    # Mięso i ryby
    ("Pierś z kurczaka",  1000,  "g"), ("Udka z kurczaka",   1000, "g"),
    ("Mięso mielone wieprzowe", 1000, "g"), ("Wołowina mielona", 1000, "g"),
    ("Łosoś",             1000,  "g"), ("Tuńczyk w puszce",   185, "g"),
    ("Szynka",             100,  "g"),
    # Warzywa
    ("Pomidory",           500,  "g"), ("Pomidory",          1000, "g"),
    ("Ogórek",             300,  "g"), ("Ogórek",            1000, "g"),
    ("Papryka czerwona",   200,  "g"), ("Papryka czerwona",  1000, "g"),
    ("Cebula",            1000,  "g"), ("Czosnek",            250, "g"),
    ("Marchew",           1000,  "g"), ("Ziemniaki",         2000, "g"),
    ("Ziemniaki",         1000,  "g"), ("Brokuły",            500, "g"),
    ("Szpinak",            100,  "g"), ("Sałata",             300, "g"),
    ("Kapusta biała",     1000,  "g"), ("Cukinia",            400, "g"),
    ("Cukinia",           1000,  "g"),
    # Owoce
    ("Banan",              100,  "g"), ("Jabłko",             200, "g"),
    ("Jabłko",            1000,  "g"), ("Cytryna",            100, "g"),
    # Tłuszcze
    ("Oliwa z oliwek",     500,  "ml"), ("Olej rzepakowy",   1000, "ml"),
    ("Masło orzechowe",   1000,  "g"),
    # Spiżarnia
    ("Cukier",            1000,  "g"), ("Miód",               400, "g"),
    ("Miód",               100,  "g"), ("Passata pomidorowa", 700, "g"),
    ("Passata pomidorowa", 100,  "g"), ("Koncentrat pomidorowy", 190, "g"),
    ("Sos sojowy",         200,  "ml"), ("Ocet jabłkowy",     500, "ml"),
    ("Musztarda",          185,  "g"), ("Majonez",            300, "g"),
    ("Bulion warzywny",    500,  "ml"),
    # Przyprawy
    ("Sól",               1000,  "g"), ("Pieprz czarny",       50, "g"),
    ("Papryka słodka",      50,  "g"), ("Papryka ostra",       50, "g"),
    ("Curry",               50,  "g"), ("Cynamon",             50, "g"),
    ("Oregano",             10,  "g"), ("Bazylia",             10, "g"),
    ("Tymianek",            10,  "g"), ("Rozmaryn",            10, "g"),
    ("Kurkuma",             50,  "g"), ("Imbir mielony",       50, "g"),
    ("Kminek",              50,  "g"), ("Chili płatki",        30, "g"),
    ("Zioła prowansalskie", 20,  "g"), ("Gałka muszkatołowa",  30, "g"),
]

DEFAULT_RECIPES = [
    {
        "name": "Owsianka",
        "ingredients": [
            ("Płatki owsiane", 50),
            ("Mleko", 200),
            ("Banan", 120),
            ("Masło orzechowe", 10),
        ],
    },
    {
        "name": "Kurczak z ryżem i warzywami",
        "ingredients": [
            ("Pierś z kurczaka", 150),
            ("Ryż", 80),
            ("Papryka czerwona", 100),
            ("Cukinia", 100),
            ("Oliwa z oliwek", 10),
            ("Sól", 3),
            ("Pieprz czarny", 2),
        ],
    },
    {
        "name": "Sałatka z tuńczykiem",
        "ingredients": [
            ("Tuńczyk w puszce", 185),
            ("Sałata", 100),
            ("Pomidory", 100),
            ("Ogórek", 80),
            ("Oliwa z oliwek", 15),
            ("Cytryna", 20),
        ],
    },
]


def seed_user(user_id):
    """Tworzy domyślne produkty i przepisy dla nowego użytkownika."""
    # Dodaj produkty
    name_to_product = {}
    for name, weight, unit in DEFAULT_PRODUCTS:
        product = Product(user_id=user_id, name=name, package_weight=weight, price=0.0, unit=unit)
        db.session.add(product)
        db.session.flush()  # pobierz ID przed commitem
        # Zapamiętaj pierwszy produkt o danej nazwie (do przepisów)
        if name not in name_to_product:
            name_to_product[name] = product

    # Dodaj przepisy
    for recipe_data in DEFAULT_RECIPES:
        recipe = Recipe(user_id=user_id, name=recipe_data["name"])
        db.session.add(recipe)
        db.session.flush()
        for prod_name, weight in recipe_data["ingredients"]:
            product = name_to_product.get(prod_name)
            if product:
                db.session.add(RecipeIngredient(
                    recipe_id=recipe.id,
                    product_id=product.id,
                    weight=weight,
                ))

    db.session.commit()
