"""Architecture policy guards for backend runtime isolation."""

from __future__ import annotations

from pathlib import Path

BACKEND_SCAN_DIRS = ("api", "services", "worker")

FORBIDDEN_SUBSTRINGS = (
    "scraper/data",
    "scraper/",
    "parents[3]",
    "parents[2]",
    "_repo_root",
    "app/user_seeds/data",
    "app/dish_compare/data",
)


def test_backend_app_has_no_legacy_monorepo_data_paths():
    app_root = Path(__file__).resolve().parents[1] / "app"
    violations: list[str] = []
    for sub in BACKEND_SCAN_DIRS:
        for path in sorted((app_root / sub).rglob("*.py")):
            source = path.read_text(encoding="utf-8")
            rel = path.relative_to(app_root)
        for needle in FORBIDDEN_SUBSTRINGS:
            if needle in source:
                violations.append(f"{rel}: contains {needle!r}")
    assert not violations, "Legacy data path coupling found:\n" + "\n".join(violations)
