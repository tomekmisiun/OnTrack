"""Scraper pipeline data layout — one place for all JSON paths."""

from pathlib import Path

SCRAPER_ROOT = Path(__file__).resolve().parent
DATA = SCRAPER_ROOT / "data"

# Hand-edited reference files
REFERENCE = DATA / "reference"
INGREDIENT_ALIASES = REFERENCE / "ingredient_aliases.json"
FOOD_CATEGORIES = REFERENCE / "food_categories.json"
DEFAULT_WEIGHTS = REFERENCE / "default_weights.json"

# Step 0 — raw scrape output
RAW = DATA / "raw"
ALI_PRODUCTS = RAW / "aldi_products.json"
AUCHAN_PRODUCTS = RAW / "auchan_products.json"
BIEDRONKA_PRODUCTS = RAW / "biedronka_products.json"
MEALPREP_RECIPES = RAW / "mealpreponfleek_recipes.json"
ALI_NAMES = RAW / "aldi_names.txt"
MEALPREP_NAMES = RAW / "mealpreponfleek_names.txt"

# Step 1–2 — normalized
NORMALIZED = DATA / "normalized"
RECIPES_NORMALIZED = NORMALIZED / "recipes_normalized.json"
RECIPES_NORMALIZED_PARTIAL = NORMALIZED / "recipes_normalized_partial.json"
ALI_NORMALIZED = NORMALIZED / "aldi_normalized.json"
AUCHAN_NORMALIZED = NORMALIZED / "auchan_normalized.json"
BIEDRONKA_NORMALIZED = NORMALIZED / "biedronka_normalized.json"
SHOPS_EN = NORMALIZED / "shops_en.json"
SHOPS_PL = NORMALIZED / "shops_pl.json"

# Step 3 — ingredient matching
MATCHED = DATA / "matched"
MATCHES_EN = MATCHED / "matches_en.json"
MATCHES_PL = MATCHED / "matches_pl.json"
UNMATCHED_EN_RAW = MATCHED / "unmatched_en_raw.json"
UNMATCHED_PL_RAW = MATCHED / "unmatched_pl_raw.json"

# Step 4 — ingredient DB + costed recipes
BUILT = DATA / "built"
INGREDIENT_DB_EN = BUILT / "ingredient_db_en.json"
INGREDIENT_DB_PL = BUILT / "ingredient_db_pl.json"
RECIPES_EN = BUILT / "recipes_en.json"
RECIPES_PL = BUILT / "recipes_pl.json"

# Step 5 — macronutrients
MACROS = DATA / "macros"
INGREDIENTS_MACROS = MACROS / "ingredients_macros.json"
INGREDIENTS_MACROS_PARTIAL = MACROS / "ingredients_macros_partial.json"

# Step 6 — user signup seeds (written by dump_seeds.py)
USER_SEEDS_DIR = SCRAPER_ROOT.parent / "app" / "user_seeds" / "data"
