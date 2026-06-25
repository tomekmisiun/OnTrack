# Backend runtime data

See `manifest.json` for dataset status and limitations.

## UI language vs product market (important)

These are **separate** user preferences:

| Field | Values | Controls |
|-------|--------|----------|
| `ui_locale` | `pl`, `en` | UI labels, login screen, help text |
| `market_code` | `PL`, `GB` | **Product & recipe catalog** (`products.lang`, `recipes.lang`) |

Mapping: `PL → pl`, `GB → en` (see `app/domain/market.py`).

- **Changing UI language** (`PATCH /api/auth/language`) does **not** switch products.
- **Changing market** (`PATCH /api/auth/market`) switches catalog language and seeds missing recipes for that lang.

There is **no runtime auto-translation** of product names. Bilingual data lives in canonical seed files; per-lang JSON is generated at build time.

## Catalog seed layout

| File | Role |
|------|------|
| `seeds/catalog_products.json` | **Source of truth** — `key`, `names.pl/en`, `markets.PL/GB`, macros |
| `seeds/catalog_recipes.json` | **Source of truth** — `names.pl/en`, ingredients with bilingual names |
| `seeds/products_seed_{pl,en}.json` | Generated — imported as global system products |
| `seeds/recipes_seed_{pl,en}.json` | Generated — copied per user on register/login |

### Rebuild from production reference user (PL)

```bash
# 1. Export PL catalog from DB (reference account)
railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" \
  uv run python -m app.scripts.export_user_catalog_to_seeds --user-id 1 --lang pl'

# 2. Build canonical + EN derivatives (uses scraper macros + EN shop prices)
uv run python -m app.scripts.build_catalog_seeds --from-exports

# 3. Regenerate lang files only (after hand-editing canonical JSON)
uv run python -m app.scripts.build_catalog_seeds
```

Validate: `uv run python scripts/validate_runtime_data.py`
