# Scraper pipeline data

All paths are defined in `scraper/data_paths.py`.

| Folder | Pipeline step | Contents |
|--------|---------------|----------|
| `reference/` | — | Hand-edited: aliases, food categories, default weights |
| `raw/` | 0 scrape | Shop JSON + recipe source + name lists |
| `normalized/` | 1–2 | Normalized recipes and shop catalogs |
| `matched/` | 3 | Ingredient ↔ product matches + unmatched |
| `built/` | 4 | Ingredient DB + costed recipes |
| `macros/` | 5 | Macronutrients per ingredient |

**Output for app:** step 6 writes to `app/user_seeds/data/`.

**Run full pipeline:**
```bash
cd scraper && python run_pipeline.py
```
