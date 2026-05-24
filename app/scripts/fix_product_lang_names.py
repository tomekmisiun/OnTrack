#!/usr/bin/env python3
"""
Rename products whose names leaked across PL/EN catalogs (e.g. komosa ryżowa in EN → quinoa).

Usage (local Docker):
    docker exec mealprep-app-1 python /app/app/scripts/fix_product_lang_names.py --all-users
    docker exec mealprep-app-1 python /app/app/scripts/fix_product_lang_names.py --user-id 2 --lang en
    docker exec mealprep-app-1 python /app/app/scripts/fix_product_lang_names.py --all-users --dry-run

Railway (backend shell / one-off):
    python app/scripts/fix_product_lang_names.py --all-users
"""

import argparse
import sys

sys.path.insert(0, "/app")
from app import create_app
from app.product_lang_fix import fix_all_users_product_lang_names, fix_user_product_lang_names

app = create_app()


def main():
    ap = argparse.ArgumentParser(description="Fix wrong-language product names in user catalogs")
    ap.add_argument("--user-id", type=int, default=None)
    ap.add_argument("--all-users", action="store_true", help="Repair every user account")
    ap.add_argument("--lang", default=None, choices=["en", "pl"], help="Only this catalog language")
    ap.add_argument("--dry-run", action="store_true", help="Report changes without saving")
    args = ap.parse_args()

    if not args.user_id and not args.all_users:
        ap.error("Provide --user-id N or --all-users")

    with app.app_context():
        if args.all_users:
            counts = fix_all_users_product_lang_names(args.lang, dry_run=args.dry_run)
            prefix = "[dry-run] " if args.dry_run else ""
            print(
                f"{prefix}Done: {counts['users']} users touched, "
                f"{counts['renamed']} renamed, {counts['merged']} merged, "
                f"{counts['skipped_unmapped']} unmapped Polish names left in EN"
            )
        else:
            counts = fix_user_product_lang_names(args.user_id, args.lang, dry_run=args.dry_run)
            prefix = "[dry-run] " if args.dry_run else ""
            print(
                f"{prefix}User {args.user_id}: {counts['renamed']} renamed, "
                f"{counts['merged']} merged, {counts['skipped_unmapped']} unmapped Polish names left in EN"
            )


if __name__ == "__main__":
    main()
