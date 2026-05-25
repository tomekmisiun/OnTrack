# Dish compare (login widget)

Public marketing widget: DIY cost vs restaurant order.

```
data/
  manifest.json     — which dishes appear per language
  dishes/           — recipe templates (catalog_id + weight)
  catalog/          — manual shop prices (PLN / GBP)
  defaults/         — restaurant prices, delivery, meal prep wage
  built/            — precomputed DIY costs (regenerate after edits)
```

**Regenerate built files:**
```bash
python app/dish_compare/build.py
```

**API:** `GET /api/public/dish-compare?lang=pl|en`  
**Frontend:** `frontend/src/features/dishCompare/DishCompare.js`
