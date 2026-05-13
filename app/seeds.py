from app import db
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient

# ── Macros (shared — same nutritional values regardless of language) ──────────
MACROS = {
    "Mleko":                    (42,  3.4,  1.0,  4.7),
    "Jogurt naturalny":         (61,  5.0,  3.1,  3.5),
    "Twaróg":                   (98,  12.0, 4.5,  2.7),
    "Ser żółty":                (380, 25.0, 31.0, 0.5),
    "Masło":                    (748, 0.5,  82.0, 0.5),
    "Śmietana 18%":             (183, 2.6,  18.0, 3.0),
    "Śmietanka 30%":            (297, 2.1,  30.0, 3.2),
    "Kefir":                    (52,  3.5,  2.0,  4.5),
    "Skyr":                     (63,  11.0, 0.2,  4.0),
    "Jajka":                    (155, 13.0, 11.0, 0.7),
    "Płatki owsiane":           (368, 13.0, 7.0,  59.0),
    "Ryż":                      (360, 7.0,  1.0,  78.0),
    "Makaron":                  (350, 12.0, 1.5,  72.0),
    "Kasza gryczana":           (343, 13.0, 3.0,  65.0),
    "Kasza jaglana":            (378, 11.0, 4.0,  72.0),
    "Kasza bulgur":             (342, 12.0, 1.0,  72.0),
    "Quinoa":                   (368, 14.0, 6.0,  64.0),
    "Mąka pszenna":             (339, 10.0, 1.0,  70.0),
    "Chleb":                    (265, 9.0,  3.0,  49.0),
    "Pierś z kurczaka":         (110, 23.0, 1.5,  0.0),
    "Udka z kurczaka":          (215, 18.0, 15.0, 0.0),
    "Mięso mielone wieprzowe":  (260, 17.0, 21.0, 0.0),
    "Wołowina mielona":         (250, 17.0, 20.0, 0.0),
    "Łosoś":                    (208, 20.0, 13.0, 0.0),
    "Tuńczyk w puszce":         (116, 26.0, 1.0,  0.0),
    "Szynka":                   (145, 20.0, 7.0,  1.0),
    "Pomidory":                 (18,  0.9,  0.2,  3.5),
    "Ogórek":                   (15,  0.7,  0.1,  2.5),
    "Papryka czerwona":         (31,  1.0,  0.3,  6.0),
    "Cebula":                   (40,  1.1,  0.1,  8.0),
    "Czosnek":                  (149, 6.0,  0.5,  30.0),
    "Marchew":                  (41,  0.9,  0.2,  8.0),
    "Ziemniaki":                (77,  2.0,  0.1,  17.0),
    "Brokuły":                  (34,  2.8,  0.4,  5.0),
    "Szpinak":                  (23,  2.9,  0.4,  1.4),
    "Sałata":                   (15,  1.4,  0.2,  1.8),
    "Kapusta biała":            (25,  1.3,  0.1,  4.7),
    "Cukinia":                  (17,  1.2,  0.1,  2.5),
    "Banan":                    (89,  1.1,  0.3,  23.0),
    "Jabłko":                   (52,  0.3,  0.2,  14.0),
    "Cytryna":                  (29,  1.1,  0.3,  6.0),
    "Oliwa z oliwek":           (884, 0.0,  100.0, 0.0),
    "Olej rzepakowy":           (884, 0.0,  100.0, 0.0),
    "Masło orzechowe":          (588, 25.0, 50.0, 20.0),
    "Cukier":                   (400, 0.0,  0.0,  100.0),
    "Miód":                     (304, 0.3,  0.0,  82.0),
    "Passata pomidorowa":       (32,  1.5,  0.2,  6.0),
    "Koncentrat pomidorowy":    (90,  4.5,  0.5,  17.0),
    "Sos sojowy":               (60,  8.0,  0.0,  6.0),
    "Ocet jabłkowy":            (21,  0.0,  0.0,  0.9),
    "Musztarda":                (66,  4.0,  3.5,  5.0),
    "Majonez":                  (680, 1.5,  75.0, 2.0),
    "Bulion warzywny":          (10,  0.5,  0.1,  2.0),
    "Sól":                      (0,   0.0,  0.0,  0.0),
    "Soda oczyszczona":         (0,   0.0,  0.0,  0.0),
    "Drożdże":                  (325, 40.0, 7.0,  38.0),
    "Pieprz czarny":            (251, 10.0, 3.0,  63.0),
    "Papryka słodka":           (282, 14.0, 13.0, 54.0),
    "Papryka ostra":            (314, 12.0, 17.0, 57.0),
    "Curry":                    (325, 14.0, 14.0, 55.0),
    "Cynamon":                  (261, 4.0,  1.2,  68.0),
    "Oregano":                  (265, 11.0, 4.0,  64.0),
    "Bazylia":                  (251, 23.0, 4.0,  48.0),
    "Tymianek":                 (101, 6.0,  1.7,  14.0),
    "Rozmaryn":                 (131, 3.3,  5.9,  20.0),
    "Kurkuma":                  (354, 8.0,  10.0, 65.0),
    "Imbir mielony":            (335, 9.0,  4.0,  71.0),
    "Kminek":                   (375, 18.0, 22.0, 44.0),
    "Chili płatki":             (282, 14.0, 13.0, 54.0),
    "Zioła prowansalskie":      (259, 12.0, 6.0,  55.0),
    "Gałka muszkatołowa":       (525, 6.0,  36.0, 49.0),
}

# Macros keyed by English name (same values, different key)
MACROS_EN = {
    "Milk":                     (42,  3.4,  1.0,  4.7),
    "Natural yogurt":           (61,  5.0,  3.1,  3.5),
    "Cottage cheese":           (98,  12.0, 4.5,  2.7),
    "Yellow cheese":            (380, 25.0, 31.0, 0.5),
    "Butter":                   (748, 0.5,  82.0, 0.5),
    "Sour cream 18%":           (183, 2.6,  18.0, 3.0),
    "Heavy cream 30%":          (297, 2.1,  30.0, 3.2),
    "Kefir":                    (52,  3.5,  2.0,  4.5),
    "Skyr":                     (63,  11.0, 0.2,  4.0),
    "Eggs":                     (155, 13.0, 11.0, 0.7),
    "Oats":                     (368, 13.0, 7.0,  59.0),
    "Rice":                     (360, 7.0,  1.0,  78.0),
    "Pasta":                    (350, 12.0, 1.5,  72.0),
    "Buckwheat":                (343, 13.0, 3.0,  65.0),
    "Millet":                   (378, 11.0, 4.0,  72.0),
    "Bulgur":                   (342, 12.0, 1.0,  72.0),
    "Quinoa":                   (368, 14.0, 6.0,  64.0),
    "Wheat flour":              (339, 10.0, 1.0,  70.0),
    "Bread":                    (265, 9.0,  3.0,  49.0),
    "Chicken breast":           (110, 23.0, 1.5,  0.0),
    "Chicken thighs":           (215, 18.0, 15.0, 0.0),
    "Ground pork":              (260, 17.0, 21.0, 0.0),
    "Ground beef":              (250, 17.0, 20.0, 0.0),
    "Salmon":                   (208, 20.0, 13.0, 0.0),
    "Canned tuna":              (116, 26.0, 1.0,  0.0),
    "Ham":                      (145, 20.0, 7.0,  1.0),
    "Tomatoes":                 (18,  0.9,  0.2,  3.5),
    "Cucumber":                 (15,  0.7,  0.1,  2.5),
    "Red pepper":               (31,  1.0,  0.3,  6.0),
    "Onion":                    (40,  1.1,  0.1,  8.0),
    "Garlic":                   (149, 6.0,  0.5,  30.0),
    "Carrot":                   (41,  0.9,  0.2,  8.0),
    "Potatoes":                 (77,  2.0,  0.1,  17.0),
    "Broccoli":                 (34,  2.8,  0.4,  5.0),
    "Spinach":                  (23,  2.9,  0.4,  1.4),
    "Lettuce":                  (15,  1.4,  0.2,  1.8),
    "White cabbage":            (25,  1.3,  0.1,  4.7),
    "Zucchini":                 (17,  1.2,  0.1,  2.5),
    "Banana":                   (89,  1.1,  0.3,  23.0),
    "Apple":                    (52,  0.3,  0.2,  14.0),
    "Lemon":                    (29,  1.1,  0.3,  6.0),
    "Olive oil":                (884, 0.0,  100.0, 0.0),
    "Rapeseed oil":             (884, 0.0,  100.0, 0.0),
    "Peanut butter":            (588, 25.0, 50.0, 20.0),
    "Sugar":                    (400, 0.0,  0.0,  100.0),
    "Honey":                    (304, 0.3,  0.0,  82.0),
    "Tomato passata":           (32,  1.5,  0.2,  6.0),
    "Tomato paste":             (90,  4.5,  0.5,  17.0),
    "Soy sauce":                (60,  8.0,  0.0,  6.0),
    "Apple cider vinegar":      (21,  0.0,  0.0,  0.9),
    "Mustard":                  (66,  4.0,  3.5,  5.0),
    "Mayonnaise":               (680, 1.5,  75.0, 2.0),
    "Vegetable broth":          (10,  0.5,  0.1,  2.0),
    "Salt":                     (0,   0.0,  0.0,  0.0),
    "Baking soda":              (0,   0.0,  0.0,  0.0),
    "Yeast":                    (325, 40.0, 7.0,  38.0),
    "Black pepper":             (251, 10.0, 3.0,  63.0),
    "Sweet paprika":            (282, 14.0, 13.0, 54.0),
    "Hot paprika":              (314, 12.0, 17.0, 57.0),
    "Curry":                    (325, 14.0, 14.0, 55.0),
    "Cinnamon":                 (261, 4.0,  1.2,  68.0),
    "Oregano":                  (265, 11.0, 4.0,  64.0),
    "Basil":                    (251, 23.0, 4.0,  48.0),
    "Thyme":                    (101, 6.0,  1.7,  14.0),
    "Rosemary":                 (131, 3.3,  5.9,  20.0),
    "Turmeric":                 (354, 8.0,  10.0, 65.0),
    "Ground ginger":            (335, 9.0,  4.0,  71.0),
    "Cumin":                    (375, 18.0, 22.0, 44.0),
    "Chili flakes":             (282, 14.0, 13.0, 54.0),
    "Herbes de Provence":       (259, 12.0, 6.0,  55.0),
    "Nutmeg":                   (525, 6.0,  36.0, 49.0),
}

# ── Polish default products ───────────────────────────────────────────────────
DEFAULT_PRODUCTS_PL = [
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
    ("Soda oczyszczona",         100, "g"),
    ("Drożdże",                    7, "g"),
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

DEFAULT_RECIPES_PL = [
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

# ── English default products ──────────────────────────────────────────────────
DEFAULT_PRODUCTS_EN = [
    # Dairy
    ("Milk",                    1000, "ml"),
    ("Natural yogurt",           400, "g"),
    ("Cottage cheese",           200, "g"),
    ("Yellow cheese",            150, "g"),
    ("Butter",                   200, "g"),
    ("Sour cream 18%",           200, "ml"),
    ("Heavy cream 30%",          200, "ml"),
    ("Kefir",                    500, "ml"),
    ("Skyr",                     150, "g"),
    ("Eggs",                      10, "szt"),
    # Grains
    ("Oats",                    1000, "g"),
    ("Rice",                    1000, "g"),
    ("Pasta",                    400, "g"),
    ("Buckwheat",               1000, "g"),
    ("Millet",                  1000, "g"),
    ("Bulgur",                  1000, "g"),
    ("Quinoa",                   400, "g"),
    ("Wheat flour",             1000, "g"),
    ("Bread",                    500, "g"),
    # Meat & fish
    ("Chicken breast",          1000, "g"),
    ("Chicken thighs",          1000, "g"),
    ("Ground pork",             1000, "g"),
    ("Ground beef",             1000, "g"),
    ("Salmon",                  1000, "g"),
    ("Canned tuna",              185, "g"),
    ("Ham",                      100, "g"),
    # Vegetables
    ("Tomatoes",                 500, "g"),
    ("Cucumber",                 300, "g"),
    ("Red pepper",               200, "g"),
    ("Onion",                   1000, "g"),
    ("Garlic",                   250, "g"),
    ("Carrot",                  1000, "g"),
    ("Potatoes",                1000, "g"),
    ("Broccoli",                 500, "g"),
    ("Spinach",                  100, "g"),
    ("Lettuce",                  300, "g"),
    ("White cabbage",           1000, "g"),
    ("Zucchini",                 400, "g"),
    # Fruits
    ("Banana",                   100, "g"),
    ("Apple",                   1000, "g"),
    ("Lemon",                    100, "g"),
    # Fats
    ("Olive oil",                500, "ml"),
    ("Rapeseed oil",            1000, "ml"),
    ("Peanut butter",           1000, "g"),
    # Pantry
    ("Sugar",                   1000, "g"),
    ("Honey",                    400, "g"),
    ("Tomato passata",           700, "g"),
    ("Tomato paste",             190, "g"),
    ("Soy sauce",                200, "ml"),
    ("Apple cider vinegar",      500, "ml"),
    ("Mustard",                  185, "g"),
    ("Mayonnaise",               300, "g"),
    ("Vegetable broth",          500, "ml"),
    # Spices
    ("Salt",                    1000, "g"),
    ("Baking soda",              100, "g"),
    ("Yeast",                      7, "g"),
    ("Black pepper",              50, "g"),
    ("Sweet paprika",             50, "g"),
    ("Hot paprika",               50, "g"),
    ("Curry",                     50, "g"),
    ("Cinnamon",                  50, "g"),
    ("Oregano",                   10, "g"),
    ("Basil",                     10, "g"),
    ("Thyme",                     10, "g"),
    ("Rosemary",                  10, "g"),
    ("Turmeric",                  50, "g"),
    ("Ground ginger",             50, "g"),
    ("Cumin",                     50, "g"),
    ("Chili flakes",              30, "g"),
    ("Herbes de Provence",        20, "g"),
    ("Nutmeg",                    30, "g"),
]

DEFAULT_RECIPES_EN = [
    {
        "name": "Oatmeal",
        "ingredients": [
            ("Oats", 50),
            ("Milk", 200),
            ("Banana", 120),
            ("Peanut butter", 10),
        ],
    },
    {
        "name": "Chicken with rice and vegetables",
        "ingredients": [
            ("Chicken breast", 150),
            ("Rice", 80),
            ("Red pepper", 100),
            ("Zucchini", 100),
            ("Olive oil", 10),
            ("Salt", 3),
            ("Black pepper", 2),
        ],
    },
    {
        "name": "Tuna salad",
        "ingredients": [
            ("Canned tuna", 185),
            ("Lettuce", 100),
            ("Tomatoes", 100),
            ("Cucumber", 80),
            ("Olive oil", 15),
            ("Lemon", 20),
        ],
    },
]


def seed_user(user_id, lang='pl'):
    """Creates default products and recipes for a new user in the chosen language."""
    if lang == 'en':
        products_list = DEFAULT_PRODUCTS_EN
        recipes_list  = DEFAULT_RECIPES_EN
        macros_map    = MACROS_EN
    else:
        products_list = DEFAULT_PRODUCTS_PL
        recipes_list  = DEFAULT_RECIPES_PL
        macros_map    = MACROS

    name_to_product = {}
    for name, weight, unit in products_list:
        m = macros_map.get(name, (None, None, None, None))
        product = Product(
            user_id=user_id, name=name,
            package_weight=weight, price=0.0, unit=unit,
            kcal=m[0], protein=m[1], fat=m[2], carbs=m[3],
        )
        db.session.add(product)
        db.session.flush()
        name_to_product[name] = product

    for recipe_data in recipes_list:
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
