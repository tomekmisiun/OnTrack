# Dish compare build tooling (legacy)

**Runtime API data lives in `backend/data/dish_compare/`.** This package is an optional
offline build tool — not part of production deploy.

To regenerate legacy built files (if you restore `data/` sources locally):

```bash
python app/dish_compare/build.py
```

**API:** `GET /api/public/dish-compare?lang=pl|en` — served from `backend/data/`.
