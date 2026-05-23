#!/usr/bin/env python3
"""
Zastępuje niedziałające URL-e zdjęć przepisów (np. mealpreponfleek.com)
obrazkami z Pexels API.

Uruchomienie (przez Docker):
    docker exec mealprep-app-1 python /app/app/scripts/fix_recipe_images.py --user-id 2
    docker exec mealprep-app-1 python /app/app/scripts/fix_recipe_images.py --user-id 2 --all
    docker exec mealprep-app-1 python /app/app/scripts/fix_recipe_images.py --user-id 2 --dry-run

Opcje:
    --user-id N   ID użytkownika (wymagane)
    --all         Zastąp też te które mają działające URL-e (nie tylko broken)
    --dry-run     Pokaż co by zostało zrobione, bez zapisu
"""

import argparse
import os
import sys
import time
import requests

sys.path.insert(0, "/app")
from app import create_app, db
from app.models.recipe import Recipe

BROKEN_DOMAINS = ("mealpreponfleek.com",)

app = create_app()


def is_broken_url(url: str | None) -> bool:
    if not url:
        return True
    return any(d in url for d in BROKEN_DOMAINS)


def fetch_pexels_image(recipe_name: str, api_key: str) -> str | None:
    try:
        r = requests.get(
            "https://api.pexels.com/v1/search",
            params={"query": recipe_name, "per_page": 5, "orientation": "landscape"},
            headers={"Authorization": api_key},
            timeout=8,
        )
        photos = r.json().get("photos") or []
        if photos:
            return photos[0]["src"]["medium"]
    except Exception as e:
        print(f"    Pexels error dla '{recipe_name}': {e}")
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user-id", type=int, required=True)
    ap.add_argument("--all",     action="store_true", help="Zastąp wszystkie URL-e, nie tylko broken")
    ap.add_argument("--dry-run", action="store_true", help="Nie zapisuj zmian")
    args = ap.parse_args()

    pexels_key = os.environ.get("PEXELS_API_KEY")
    if not pexels_key:
        print("Brak PEXELS_API_KEY w zmiennych środowiskowych.")
        sys.exit(1)

    with app.app_context():
        recipes = Recipe.query.filter_by(user_id=args.user_id).all()
        to_fix = [r for r in recipes if args.all or is_broken_url(r.image_url)]

        print(f"Przepisy użytkownika {args.user_id}: {len(recipes)} łącznie, {len(to_fix)} do naprawy")
        if args.dry_run:
            print("(dry-run — zmiany nie zostaną zapisane)")
        print()

        updated = 0
        failed = 0

        for recipe in to_fix:
            print(f"  [{updated+failed+1}/{len(to_fix)}] {recipe.name[:60]}")
            new_url = fetch_pexels_image(recipe.name, pexels_key)

            if new_url:
                print(f"    ✓ {new_url[:80]}")
                if not args.dry_run:
                    recipe.image_url = new_url
                updated += 1
            else:
                print(f"    ✗ brak wyniku Pexels")
                failed += 1

            time.sleep(0.3)  # nie przeciążaj API

        if not args.dry_run:
            db.session.commit()

        print()
        print(f"Gotowe: zaktualizowano {updated}, nieudane {failed}")


if __name__ == "__main__":
    main()
