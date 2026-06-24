# Backend runtime data (demo)

See `manifest.json` for dataset status and limitations.

## Classification (DATA-002)

| Dataset | Legacy path | Consumer | Trust status | Action in `backend/data` |
|---------|-------------|----------|--------------|-------------------------|
| Product seeds (PL/EN) | `app/user_seeds/data/products_seed_*.json` | `catalog_seed_service` | generated / unverified | **synthetic** — 2 demo products per lang |
| Recipe seeds (PL/EN) | `app/user_seeds/data/recipes_seed_*.json` | `catalog_seed_service` | generated / unverified | **synthetic** — 1 demo recipe per lang |
| Dish compare defaults | `app/dish_compare/data/defaults/` | `dish_compare_loader` | mixed (hand defaults + scraper-built costs) | **synthetic** — 5 dishes, round demo prices |
| Dish compare built | `app/dish_compare/data/built/` | `dish_compare_loader` | generated (pipeline costs) | **synthetic** — minimal ingredient lists |
| Ingredients macros | `scraper/data/macros/ingredients_macros.json` | `macro_lookup`, `import_names` | generated / unverified | **synthetic** — 8 demo ingredients |
| Recipes PL lookup | `scraper/data/built/recipes_pl.json` | `recipe_image_service` | generated / unverified | **synthetic** — 1 demo row |
| `ingredient_db_*.json` | `scraper/data/built/` | scraper only | unused by backend | **skipped** |
| `recipes_en.json` | `scraper/data/built/` | unused by backend | unused | **skipped** |
| Macro AI cache | `app/data/macro_ai_cache.json` | `macro_lookup` (runtime write) | runtime cache | **not in dataset** (created at runtime) |

Validate: `uv run python scripts/validate_runtime_data.py`
