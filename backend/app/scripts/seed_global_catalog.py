"""Idempotent import of system products from backend/data/seeds into PostgreSQL."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.core.runtime_data import runtime_data_root, seeds_dir
from app.domain.product_normalize import normalize_product_name
from app.models.product import Product

_CATALOG_KEY_SAFE = re.compile(r"[^a-z0-9._-]+")


def catalog_key_for_seed(lang: str, seed_index: int, name: str) -> str:
    """Stable catalog key from lang + seed file order + normalized name slug."""
    slug = _CATALOG_KEY_SAFE.sub(
        "-",
        normalize_product_name(name).replace(" ", "-"),
    ).strip("-")[:80]
    return f"seed:{lang}:{seed_index}:{slug}"


def _load_seed_products(lang: str) -> list[dict]:
    base = seeds_dir()
    for fname in (f"products_seed_{lang}.json", "products_seed_pl.json"):
        path = base / fname
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
    return []


def _seed_row_matches_product(row: dict, product: Product, lang: str) -> bool:
    """Deterministic full match for legacy per-user seed copies."""
    if product.lang != lang:
        return False
    if product.source not in ("legacy", "user"):
        return False
    name = (row.get("name") or "").strip()
    if normalize_product_name(product.name) != normalize_product_name(name):
        return False
    try:
        if float(product.price) != float(row.get("price") or 0):
            return False
        if float(product.package_weight) != float(row.get("package_weight") or 100):
            return False
    except (TypeError, ValueError):
        return False
    if (product.unit or "g") != (row.get("unit") or "g"):
        return False
    if bool(product.sold_by_weight) != bool(row.get("sold_by_weight", False)):
        return False
    for macro in ("kcal", "protein", "fat", "carbs"):
        row_val = row.get(macro)
        prod_val = getattr(product, macro)
        if row_val is None and prod_val is None:
            continue
        if row_val is None or prod_val is None:
            return False
        if float(prod_val) != float(row_val):
            return False
    return True


@dataclass
class GlobalCatalogImportReport:
    created: int = 0
    updated: int = 0
    linked_legacy: int = 0
    ambiguous_legacy: int = 0
    skipped_ambiguous_ids: list[int] = field(default_factory=list)
    dataset_type: str | None = None

    def as_dict(self) -> dict:
        return {
            "created": self.created,
            "updated": self.updated,
            "linked_legacy": self.linked_legacy,
            "ambiguous_legacy": self.ambiguous_legacy,
            "skipped_ambiguous_ids": self.skipped_ambiguous_ids,
            "dataset_type": self.dataset_type,
        }


def import_global_catalog(session: Session, lang: str) -> GlobalCatalogImportReport:
    """UPSERT system products for ``lang`` and link unambiguous legacy copies."""
    report = GlobalCatalogImportReport()
    rows = _load_seed_products(lang)
    if not rows:
        return report

    manifest_path = runtime_data_root() / "manifest.json"
    dataset_type = "unknown"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        dataset_type = manifest.get("dataset_type", "unknown")

    system_by_key: dict[str, Product] = {
        p.catalog_key: p
        for p in session.query(Product)
        .filter_by(source="system", lang=lang)
        .filter(Product.catalog_key.isnot(None))
        .all()
        if p.catalog_key
    }

    for idx, row in enumerate(rows):
        name = (row.get("name") or "").strip()
        if not name:
            continue
        key = catalog_key_for_seed(lang, idx, name)
        existing = system_by_key.get(key) or session.query(Product).filter_by(
            source="system", lang=lang, catalog_key=key
        ).first()

        payload = {
            "name": name[:255],
            "normalized_name": normalize_product_name(name),
            "price": float(row.get("price") or 0),
            "package_weight": float(row.get("package_weight") or 100),
            "unit": (row.get("unit") or "g")[:10],
            "sold_by_weight": bool(row.get("sold_by_weight", False)),
            "kcal": row.get("kcal"),
            "protein": row.get("protein"),
            "fat": row.get("fat"),
            "carbs": row.get("carbs"),
            "lang": lang,
            "user_id": None,
            "source": "system",
            "catalog_key": key,
        }

        if existing:
            changed = False
            for field, value in payload.items():
                if field in ("user_id", "source", "catalog_key", "lang"):
                    continue
                if getattr(existing, field) != value:
                    setattr(existing, field, value)
                    changed = True
            if changed:
                report.updated += 1
            system_product = existing
        else:
            system_product = Product(**payload)
            session.add(system_product)
            session.flush()
            system_by_key[key] = system_product
            report.created += 1

        _link_legacy_copies(session, row, lang, system_product, report)

    session.commit()
    report.dataset_type = dataset_type
    return report


def _link_legacy_copies(
    session: Session,
    row: dict,
    lang: str,
    system_product: Product,
    report: GlobalCatalogImportReport,
) -> None:
    candidates = [
        p
        for p in session.query(Product)
        .filter(Product.user_id.isnot(None), Product.lang == lang)
        .filter(Product.source.in_(("legacy", "user")))
        .all()
        if _seed_row_matches_product(row, p, lang)
    ]
    if not candidates:
        return
    if len(candidates) > 1:
        report.ambiguous_legacy += len(candidates)
        report.skipped_ambiguous_ids.extend(p.id for p in candidates)
        return
    legacy = candidates[0]
    if legacy.base_product_id != system_product.id:
        legacy.base_product_id = system_product.id
        report.linked_legacy += 1


def main() -> None:
    import argparse

    from app.db.session import get_session_factory

    parser = argparse.ArgumentParser(description="Import global product catalog from seed JSON")
    parser.add_argument("--lang", choices=("pl", "en"), default="pl")
    args = parser.parse_args()

    session = get_session_factory()()
    try:
        report = import_global_catalog(session, args.lang)
        print(json.dumps(report.as_dict(), indent=2))
    finally:
        session.close()


if __name__ == "__main__":
    main()
