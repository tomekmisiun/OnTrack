"""
Seeding domyślnych produktów dla nowych użytkowników.

Produkty są wczytywane z pliku JSON:
  app/data/products_seed_pl.json  — dla języka polskiego
  app/data/products_seed_en.json  — dla języka angielskiego (jeśli istnieje)

Plik seed generujesz po scrapowaniu:
  cd scraper
  python catalog_scraper.py --scrape all --user-id 2
  python export_seeds.py catalog_products.json

Jeśli plik seed nie istnieje — nowy użytkownik dostaje pustą listę produktów.
"""

import json
from pathlib import Path

from app import db
from app.models.product import Product

DATA_DIR = Path(__file__).parent / "data"


def _load_seed_file(lang: str) -> list[dict]:
    """Wczytuje plik seed dla danego języka. Fallback do PL jeśli EN nie istnieje."""
    for fname in (f"products_seed_{lang}.json", "products_seed_pl.json"):
        path = DATA_DIR / fname
        if path.exists():
            try:
                with open(path, encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list) and data:
                    return data
            except Exception:
                pass
    return []


def seed_user(user_id: int, lang: str = "pl"):
    """
    Tworzy domyślne produkty dla nowego użytkownika z pliku seed.
    Jeśli plik nie istnieje — użytkownik zaczyna z pustą listą.
    """
    products = _load_seed_file(lang)
    if not products:
        return

    for p in products:
        name = (p.get("name") or "").strip()[:200]
        if not name:
            continue
        db.session.add(Product(
            user_id=user_id,
            name=name,
            price=float(p.get("price") or 0),
            package_weight=float(p.get("package_weight") or 100),
            unit=p.get("unit") or "g",
            sold_by_weight=bool(p.get("sold_by_weight", False)),
            kcal=p.get("kcal"),
            protein=p.get("protein"),
            fat=p.get("fat"),
            carbs=p.get("carbs"),
        ))

    db.session.commit()
