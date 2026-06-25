from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.scripts.seed_global_catalog import (
    _load_seed_products,
    catalog_key_for_seed,
    import_global_catalog,
)

from tests.conftest import create_user


def _jogurt_seed_row() -> dict:
    for row in _load_seed_products("pl"):
        if row["name"] == "jogurt naturalny":
            return row
    raise AssertionError("jogurt naturalny missing from pl seed")


def _legacy_product_from_seed(user_id: int, row: dict) -> Product:
    return Product(
        user_id=user_id,
        source="legacy",
        normalized_name=normalize_product_name(row["name"]),
        name=row["name"],
        package_weight=row["package_weight"],
        price=row["price"],
        unit=row["unit"],
        kcal=row.get("kcal"),
        protein=row.get("protein"),
        fat=row.get("fat"),
        carbs=row.get("carbs"),
        lang="pl",
    )


def test_catalog_key_is_stable():
    key = catalog_key_for_seed("pl", 0, "jogurt naturalny")
    assert key == catalog_key_for_seed("pl", 0, "jogurt naturalny")
    assert key.startswith("seed:pl:0:")


def test_import_global_catalog_creates_system_products(db_session):
    report = import_global_catalog(db_session, "pl")
    assert report.created >= 2
    assert report.updated == 0
    system = (
        db_session.query(Product)
        .filter_by(source="system", lang="pl")
        .filter(Product.user_id.is_(None))
        .all()
    )
    assert len(system) >= 2
    assert all(p.catalog_key for p in system)


def test_import_global_catalog_is_idempotent(db_session):
    first = import_global_catalog(db_session, "pl")
    second = import_global_catalog(db_session, "pl")
    assert first.created >= 2
    assert second.created == 0
    assert second.updated == 0
    count = (
        db_session.query(Product)
        .filter_by(source="system", lang="pl")
        .filter(Product.user_id.is_(None))
        .count()
    )
    assert count == first.created


def test_import_links_deterministic_legacy_copy(db_session):
    user = create_user(db_session, "legacy-link@example.com", lang="pl")
    seed_row = _jogurt_seed_row()
    legacy = _legacy_product_from_seed(user.id, seed_row)
    db_session.add(legacy)
    db_session.commit()

    report = import_global_catalog(db_session, "pl")
    db_session.refresh(legacy)
    assert report.linked_legacy >= 1
    assert legacy.base_product_id is not None
    system = db_session.get(Product, legacy.base_product_id)
    assert system is not None
    assert system.source == "system"
    assert system.user_id is None


def test_import_skips_ambiguous_legacy_matches(db_session):
    user = create_user(db_session, "ambig@example.com", lang="pl")
    seed_row = _jogurt_seed_row()
    for _ in range(2):
        db_session.add(_legacy_product_from_seed(user.id, seed_row))
    db_session.commit()

    report = import_global_catalog(db_session, "pl")
    assert report.ambiguous_legacy >= 2
    assert report.linked_legacy == 0
