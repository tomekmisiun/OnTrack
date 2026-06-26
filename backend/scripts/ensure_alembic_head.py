#!/usr/bin/env python3
"""Deploy-time Alembic: adopt legacy Flask revision ids, then upgrade to head."""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from app.db.schema_validate import ONTRACK_ALEMBIC_HEAD
from sqlalchemy import create_engine, text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REVISION_RE = re.compile(r"""^revision:\s*str\s*=\s*['"]([^'"]+)['"]""", re.M)


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL is not set", file=sys.stderr)
        sys.exit(1)
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def _fastapi_revisions() -> set[str]:
    versions_dir = BACKEND_ROOT / "alembic" / "versions"
    revisions: set[str] = set()
    for path in versions_dir.glob("*.py"):
        match = REVISION_RE.search(path.read_text(encoding="utf-8"))
        if match:
            revisions.add(match.group(1))
    return revisions


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    return cfg


def _current_revision(url: str) -> str | None:
    engine = create_engine(url)
    try:
        with engine.connect() as conn:
            return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    except Exception:
        return None
    finally:
        engine.dispose()


def main() -> None:
    url = _database_url()
    fastapi_revisions = _fastapi_revisions()
    current = _current_revision(url)
    print(f"alembic_version (database): {current or '<empty>'}")

    cfg = _alembic_config()

    if current and current not in fastapi_revisions:
        print(
            f"Legacy (non-FastAPI) revision detected: {current}",
            file=sys.stderr,
        )
        print(
            f"Stamping alembic_version -> {ONTRACK_ALEMBIC_HEAD} (purge, no DDL)...",
            file=sys.stderr,
        )
        command.stamp(cfg, ONTRACK_ALEMBIC_HEAD, purge=True)

    print("Running alembic upgrade head...")
    command.upgrade(cfg, "head")
    print("Alembic current:")
    command.current(cfg)


if __name__ == "__main__":
    main()
