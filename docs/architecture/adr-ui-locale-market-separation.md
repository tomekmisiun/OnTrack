# ADR: UI locale vs market code

## Status

Accepted (2026-06-27)

## Context

OnTrack previously derived catalog language from the user's market (`PL → pl`, `GB → en`). That coupled product/recipe names, macro label conventions, and prices incorrectly.

## Decision

- **`ui_locale`** controls localization only: UI strings, system product/recipe names, macro letter labels (B/T/W vs P/F/C).
- **`market_code`** controls market context only: product prices, currency (PLN/GBP), recipe cost calculations.
- System catalog rows are **neutral identities** (`catalog_key`) with:
  - `product_translations` / `recipe_translations` per locale
  - `product_market_prices` per market
- User-owned products/recipes store the user-entered name once; they are visible across locale/market changes.
- Missing market price is explicit (`has_price: false`, `price: null`) — no FX conversion.

## Consequences

- Changing language refreshes localized catalog data; changing market refreshes prices.
- Meal plans keep stable `recipe_id` / `product_id`.
- Canonical JSON (`backend/data/canonical/`) is the seed source of truth.
