# Scraper (archived — experimental / disconnected)

**Status:** archived under `archive/scraper-legacy/`. **Not part of OnTrack API runtime or Railway deployment.**

This pipeline is kept for historical reference only. Runtime catalog data lives in
`backend/data/canonical/` → `generated/` → `import_catalog`.

## Purpose

The archived `scraper/` directory contained an offline data pipeline (shop scraping, recipe
normalization, ingredient matching, macro enrichment). It is kept for experiments
and future rework.

## Relationship to the backend

| Topic | Policy |
|-------|--------|
| Runtime | FastAPI reads **only** `backend/data/` (see `backend/data/manifest.json`) |
| Deploy | Scraper is **not** copied into the backend Docker image |
| Pipeline output | Written to `scraper/output/` by default |
| `backend/data/` | **Never** overwritten automatically by the pipeline |
| Export to backend | Requires `ALLOW_SCRAPER_EXPORT_TO_BACKEND=1` **and** manual review |

## Data quality warning

The transformation and matching steps currently produce **unreliable** records
(incorrect macros, prices, and product links). Do **not** treat pipeline output as
production-approved nutrition or catalog data.

Fixing the pipeline is **out of scope** of the backend migration. Any integration
with `backend/data/` requires:

1. Manual validation (`backend/scripts/validate_runtime_data.py`)
2. Updated `manifest.json` (`dataset_type`, provenance, limitations)
3. Explicit team sign-off

## Running locally

```bash
cd scraper
python run_pipeline.py
```

Seed export (step 6) writes to `scraper/output/seeds/` — not `app/user_seeds/`
or `backend/data/`.

See also: `scraper/data/README.md`, [`docs/archive/audits/backend-migration-completed/DATA_DEPLOYMENT_ROADMAP.md`](../../docs/archive/audits/backend-migration-completed/DATA_DEPLOYMENT_ROADMAP.md) (historical).
