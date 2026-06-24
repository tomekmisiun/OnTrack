"""Safety-net tests for product catalog isolation, seed behavior, and migration guards.

These tests document current (legacy) behavior before the global catalog migration.
Tests marked ``legacy_catalog_copy`` are expected to change in Task 6.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from app.core.runtime_data import seeds_dir
from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.user import User
from app.services.catalog_seed_service import _seed_products, ensure_user_seeded
from app.worker.jobs import process_job
from app.worker.queue import drain_testing_jobs, reset_testing_jobs

from tests.conftest import create_user

LEGACY_CATALOG_COPY = pytest.mark.legacy_catalog_copy(
    reason=(
        "Documents per-user seed copy; replace in Task 6 "
        "(refactor/remove-per-user-product-seed)."
    ),
)


def _seed_product_count(lang: str = "pl") -> int:
    path = seeds_dir() / f"products_seed_{lang}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return sum(1 for item in data if (item.get("name") or "").strip())


# --- Cross-user isolation (authorization) ---


def test_user_a_cannot_see_user_b_private_product(
    client, auth_headers, other_auth_headers, product
):
    res = client.get("/api/products/", headers=other_auth_headers)
    assert res.status_code == 200
    ids = {p["id"] for p in res.json()}
    assert product.id not in ids


def test_user_a_cannot_update_user_b_product(client, auth_headers, other_auth_headers, product):
    res = client.put(
        f"/api/products/{product.id}",
        headers=other_auth_headers,
        json={"price": 9.99},
    )
    assert res.status_code == 404


def test_user_a_cannot_delete_user_b_product(client, auth_headers, other_auth_headers, product):
    res = client.delete(f"/api/products/{product.id}", headers=other_auth_headers)
    assert res.status_code == 404


def test_user_a_cannot_use_user_b_product_in_recipe(client, other_auth_headers, product):
    res = client.post(
        "/api/recipes/",
        headers=other_auth_headers,
        json={
            "name": "Cudzy przepis",
            "category": "lunch",
            "servings": 2,
            "ingredients": [{"product_id": product.id, "weight": 100}],
        },
    )
    assert res.status_code == 404
    assert "not found" in res.json()["error"].lower()


# --- Legacy per-user seed on registration ---


@LEGACY_CATALOG_COPY
def test_legacy_register_copies_seed_products_per_user(client, db_session):
    """Registration currently inserts seed JSON rows with user_id — change in Task 6."""
    reg = client.post(
        "/api/auth/register",
        json={"username": "legacyseed1", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter_by(username="legacyseed1").first()
    assert user is not None
    count = db_session.query(Product).filter_by(user_id=user.id, lang="pl").count()
    assert count >= _seed_product_count("pl")


# --- Seed idempotency ---


def test_ensure_user_seeded_twice_does_not_duplicate(db_session):
    user = create_user(db_session, "idempotent@example.com", lang="pl")
    ensure_user_seeded(db_session, user.id, "pl")
    after_first = db_session.query(Product).filter_by(user_id=user.id, lang="pl").count()
    assert after_first >= _seed_product_count("pl")

    ensure_user_seeded(db_session, user.id, "pl")
    after_second = db_session.query(Product).filter_by(user_id=user.id, lang="pl").count()
    assert after_second == after_first


@pytest.mark.xfail(
    reason=(
        "_seed_products has no per-row deduplication; "
        "guard only checks any product with price > 0. "
        "Direct re-entry creates duplicates — fix planned in global catalog import (Task 3)."
    ),
    strict=True,
)
def test_xfail_direct_seed_products_twice_creates_duplicates(db_session):
    user = create_user(db_session, "dupseed@example.com", lang="pl")
    _seed_products(db_session, user.id, "pl")
    first_count = db_session.query(Product).filter_by(user_id=user.id, lang="pl").count()
    _seed_products(db_session, user.id, "pl")
    second_count = db_session.query(Product).filter_by(user_id=user.id, lang="pl").count()
    assert second_count == first_count


# --- Product list (current contract: no pagination) ---


def test_product_list_excludes_other_users_products(
    client, auth_headers, other_auth_headers, product
):
    res = client.get("/api/products/", headers=other_auth_headers)
    assert res.status_code == 200
    assert all(p["id"] != product.id for p in res.json())


def test_product_list_filters_by_user_language(client, auth_headers, user, db_session):
    foreign_lang = Product(
        user_id=user.id,
        source="user",
        normalized_name=normalize_product_name("English only item"),
        name="English only item",
        package_weight=100,
        price=1.0,
        unit="g",
        lang="en",
    )
    db_session.add(foreign_lang)
    db_session.commit()
    db_session.refresh(foreign_lang)

    res = client.get("/api/products/", headers=auth_headers)
    assert res.status_code == 200
    ids = {p["id"] for p in res.json()}
    assert foreign_lang.id not in ids


def test_product_list_has_no_pagination_legacy(client, auth_headers, product):
    """Documents current API: full list returned, no limit/offset/total metadata."""
    res = client.get("/api/products/", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    # OpenAPI route has no pagination query params today.
    routes_path = Path(__file__).resolve().parents[2] / "app" / "api" / "routes" / "products.py"
    source = routes_path.read_text(encoding="utf-8")
    assert "limit" not in source.split("def get_products")[1].split("def ")[0]
    assert "offset" not in source.split("def get_products")[1].split("def ")[0]


# --- Worker / registration (worker not required; redundant enqueue) ---


def test_register_does_not_require_worker_job_processing(client, db_session):
    """Catalog is seeded synchronously; worker job is not required for products to exist."""
    reset_testing_jobs()
    reg = client.post(
        "/api/auth/register",
        json={"username": "noworker1", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter_by(username="noworker1").first()
    product_count = db_session.query(Product).filter_by(user_id=user.id, lang="pl").count()
    assert product_count >= _seed_product_count("pl")
    jobs = drain_testing_jobs()
    assert any(j.get("type") == "catalog_seed" for j in jobs)


def test_register_sync_and_worker_seed_are_idempotent(client, db_session, engine, monkeypatch):
    """Sync seed on register + enqueued job must not double the catalog."""
    from sqlalchemy.orm import sessionmaker

    bind = db_session.get_bind()
    monkeypatch.setattr(
        "app.worker.jobs.get_session_factory",
        lambda: sessionmaker(bind=bind, autocommit=False, autoflush=False),
    )
    reset_testing_jobs()
    reg = client.post(
        "/api/auth/register",
        json={"username": "redundant1", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter_by(username="redundant1").first()
    before_job = db_session.query(Product).filter_by(user_id=user.id, lang="pl").count()
    assert before_job >= _seed_product_count("pl")

    jobs = drain_testing_jobs()
    assert jobs
    process_job(jobs[0])
    after_job = db_session.query(Product).filter_by(user_id=user.id, lang="pl").count()
    assert after_job == before_job


def test_inline_fallback_runs_catalog_seed_without_redis(db_session, engine, monkeypatch):
    """Without REDIS_URL and outside TESTING queue mode, enqueue runs process_job inline."""
    from app.core.config import Settings
    from app.worker import queue as queue_mod
    from sqlalchemy.orm import sessionmaker

    user = create_user(db_session, "inline@example.com", lang="pl")
    db_session.query(Product).filter_by(user_id=user.id).delete()
    db_session.query(Recipe).filter_by(user_id=user.id).delete()
    db_session.commit()

    bind = db_session.get_bind()
    monkeypatch.setattr(
        "app.worker.jobs.get_session_factory",
        lambda: sessionmaker(bind=bind, autocommit=False, autoflush=False),
    )

    fake_settings = Settings(
        testing=False,
        redis_url=None,
        database_url="sqlite://",
    )
    monkeypatch.setattr(queue_mod, "get_settings", lambda: fake_settings)

    queue_mod.enqueue_catalog_seed(user.id, "pl")
    product_count = db_session.query(Product).filter_by(user_id=user.id, lang="pl").count()
    assert product_count >= _seed_product_count("pl")
