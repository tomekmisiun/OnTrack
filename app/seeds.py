from app import db
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient

MACROS = {
    "Mleko": (42,3.4,1.0,4.7), "Jogurt naturalny": (61,5.0,3.1,3.5),
    "Twaróg": (98,12.0,4.5,2.7), "Ser żółty": (380,25.0,31.0,0.5),
    "Masło": (748,0.5,82.0,0.5), "Śmietana 18%": (183,2.6,18.0,3.0),
    "Śmietanka 30%": (297,2.1,30.0,3.2), "Kefir": (52,3.5,2.0,4.5),
    "Skyr": (63,11.0,0.2,4.0), "Jajka": (155,13.0,11.0,0.7),
    "Płatki owsiane": (368,13.0,7.0,59.0), "Ryż": (360,7.0,1.0,78.0),
    "Makaron": (350,12.0,1.5,72.0), "Kasza gryczana": (343,13.0,3.0,65.0),
    "Kasza jaglana": (378,11.0,4.0,72.0), "Kasza bulgur": (342,12.0,1.0,72.0),
    "Quinoa": (368,14.0,6.0,64.0), "Mąka pszenna": (339,10.0,1.0,70.0),
    "Chleb": (265,9.0,3.0,49.0), "Pierś z kurczaka": (110,23.0,1.5,0.0),
    "Udka z kurczaka": (215,18.0,15.0,0.0), "Mięso mielone wieprzowe": (260,17.0,21.0,0.0),
    "Wołowina mielona": (250,17.0,20.0,0.0), "Łosoś": (208,20.0,13.0,0.0),
    "Tuńczyk w puszce": (116,26.0,1.0,0.0), "Szynka": (145,20.0,7.0,1.0),
    "Pomidory": (18,0.9,0.2,3.5), "Ogórek": (15,0.7,0.1,2.5),
    "Papryka czerwona": (31,1.0,0.3,6.0), "Cebula": (40,1.1,0.1,8.0),
    "Czosnek": (149,6.0,0.5,30.0), "Marchew": (41,0.9,0.2,8.0),
    "Ziemniaki": (77,2.0,0.1,17.0), "Brokuły": (34,2.8,0.4,5.0),
    "Szpinak": (23,2.9,0.4,1.4), "Sałata": (15,1.4,0.2,1.8),
    "Kapusta biała": (25,1.3,0.1,4.7), "Cukinia": (17,1.2,0.1,2.5),
    "Banan": (89,1.1,0.3,23.0), "Jabłko": (52,0.3,0.2,14.0),
    "Cytryna": (29,1.1,0.3,6.0), "Oliwa z oliwek": (884,0.0,100.0,0.0),
    "Olej rzepakowy": (884,0.0,100.0,0.0), "Masło orzechowe": (588,25.0,50.0,20.0),
    "Cukier": (400,0.0,0.0,100.0), "Miód": (304,0.3,0.0,82.0),
    "Passata pomidorowa": (32,1.5,0.2,6.0), "Koncentrat pomidorowy": (90,4.5,0.5,17.0),
    "Sos sojowy": (60,8.0,0.0,6.0), "Ocet jabłkowy": (21,0.0,0.0,0.9),
    "Musztarda": (66,4.0,3.5,5.0), "Majonez": (680,1.5,75.0,2.0),
    "Bulion warzywny": (10,0.5,0.1,2.0), "Sól": (0,0.0,0.0,0.0),
    "Pieprz czarny": (251,10.0,3.0,63.0), "Papryka słodka": (282,14.0,13.0,54.0),
    "Papryka ostra": (314,12.0,17.0,57.0), "Curry": (325,14.0,14.0,55.0),
    "Cynamon": (261,4.0,1.2,68.0), "Oregano": (265,11.0,4.0,64.0),
    "Bazylia": (251,23.0,4.0,48.0), "Tymianek": (101,6.0,1.7,14.0),
    "Rozmaryn": (131,3.3,5.9,20.0), "Kurkuma": (354,8.0,10.0,65.0),
    "Imbir mielony": (335,9.0,4.0,71.0), "Kminek": (375,18.0,22.0,44.0),
    "Chili płatki": (282,14.0,13.0,54.0), "Zioła prowansalskie": (259,12.0,6.0,55.0),
    "Gałka muszkatołowa": (525,6.0,36.0,49.0),
}

DEFAULT_PRODUCTS = [
    # Nabiał
    ("Mleko",                   1000, "ml"),
    ("Jogurt naturalny",         400, "g"),
    ("Twaróg",                   200, "g"),
    ("Ser żółty",                150, "g"),
    ("Masło",                    200, "g"),
    ("Śmietana 18%",             200, "ml"),
    ("Śmietanka 30%",            200, "ml"),
    ("Kefir",                    500, "ml"),
    ("Skyr",                     150, "g"),
    ("Jajka",                     10, "szt"),
    # Zboża
    ("Płatki owsiane",          1000, "g"),
    ("Ryż",                     1000, "g"),
    ("Makaron",                  400, "g"),
    ("Kasza gryczana",          1000, "g"),
    ("Kasza jaglana",           1000, "g"),
    ("Kasza bulgur",            1000, "g"),
    ("Quinoa",                   400, "g"),
    ("Mąka pszenna",            1000, "g"),
    ("Chleb",                    500, "g"),
    # Mięso i ryby
    ("Pierś z kurczaka",        1000, "g"),
    ("Udka z kurczaka",         1000, "g"),
    ("Mięso mielone wieprzowe", 1000, "g"),
    ("Wołowina mielona",        1000, "g"),
    ("Łosoś",                   1000, "g"),
    ("Tuńczyk w puszce",         185, "g"),
    ("Szynka",                   100, "g"),
    # Warzywa
    ("Pomidory",                 500, "g"),
    ("Ogórek",                   300, "g"),
    ("Papryka czerwona",         200, "g"),
    ("Cebula",                  1000, "g"),
    ("Czosnek",                  250, "g"),
    ("Marchew",                 1000, "g"),
    ("Ziemniaki",               1000, "g"),
    ("Brokuły",                  500, "g"),
    ("Szpinak",                  100, "g"),
    ("Sałata",                   300, "g"),
    ("Kapusta biała",           1000, "g"),
    ("Cukinia",                  400, "g"),
    # Owoce
    ("Banan",                    100, "g"),
    ("Jabłko",                  1000, "g"),
    ("Cytryna",                  100, "g"),
    # Tłuszcze
    ("Oliwa z oliwek",           500, "ml"),
    ("Olej rzepakowy",          1000, "ml"),
    ("Masło orzechowe",         1000, "g"),
    # Spiżarnia
    ("Cukier",                  1000, "g"),
    ("Miód",                     400, "g"),
    ("Passata pomidorowa",       700, "g"),
    ("Koncentrat pomidorowy",    190, "g"),
    ("Sos sojowy",               200, "ml"),
    ("Ocet jabłkowy",            500, "ml"),
    ("Musztarda",                185, "g"),
    ("Majonez",                  300, "g"),
    ("Bulion warzywny",          500, "ml"),
    # Przyprawy
    ("Sól",                     1000, "g"),
    ("Pieprz czarny",             50, "g"),
    ("Papryka słodka",            50, "g"),
    ("Papryka ostra",             50, "g"),
    ("Curry",                     50, "g"),
    ("Cynamon",                   50, "g"),
    ("Oregano",                   10, "g"),
    ("Bazylia",                   10, "g"),
    ("Tymianek",                  10, "g"),
    ("Rozmaryn",                  10, "g"),
    ("Kurkuma",                   50, "g"),
    ("Imbir mielony",             50, "g"),
    ("Kminek",                    50, "g"),
    ("Chili płatki",              30, "g"),
    ("Zioła prowansalskie",       20, "g"),
    ("Gałka muszkatołowa",        30, "g"),
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
    name_to_product = {}
    for name, weight, unit in DEFAULT_PRODUCTS:
        m = MACROS.get(name, (None, None, None, None))
        product = Product(user_id=user_id, name=name, package_weight=weight, price=0.0, unit=unit,
                          kcal=m[0], protein=m[1], fat=m[2], carbs=m[3])
        db.session.add(product)
        db.session.flush()
        name_to_product[name] = product

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
