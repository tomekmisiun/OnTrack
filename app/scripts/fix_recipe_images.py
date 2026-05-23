#!/usr/bin/env python3
"""
Replace recipe thumbnails with images from Pexels (drops mealpreponfleek.com URLs).

Usage (via Docker):
    docker exec mealprep-app-1 python /app/app/scripts/fix_recipe_images.py --user-id 2
    docker exec mealprep-app-1 python /app/app/scripts/fix_recipe_images.py --user-id 2 --all
    docker exec mealprep-app-1 python /app/app/scripts/fix_recipe_images.py --user-id 2 --lang pl
    docker exec mealprep-app-1 python /app/app/scripts/fix_recipe_images.py --user-id 2 --dry-run
"""

import argparse
import os
import sys

sys.path.insert(0, "/app")
from app import create_app
from app.pexels import apply_pexels_to_user_recipes

app = create_app()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user-id", type=int, required=True)
    ap.add_argument("--lang", default=None, choices=["en", "pl"])
    ap.add_argument("--all", action="store_true", help="Replace all URLs, not just source/broken ones")
    ap.add_argument("--dry-run", action="store_true", help="Show counts without saving")
    args = ap.parse_args()

    if not os.environ.get("PEXELS_API_KEY"):
        print("PEXELS_API_KEY not set in environment.")
        sys.exit(1)

    with app.app_context():
        updated, failed, skipped = apply_pexels_to_user_recipes(
            args.user_id,
            args.lang,
            replace_all=args.all,
            dry_run=args.dry_run,
        )
        if args.dry_run:
            print("(dry-run — no changes saved)")
        print(f"Done: updated={updated}, failed={failed}, skipped={skipped}")


if __name__ == "__main__":
    main()
