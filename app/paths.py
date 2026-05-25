"""Central path constants for static data and runtime cache."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_ROOT = REPO_ROOT / "app"

DISH_COMPARE_DIR = APP_ROOT / "dish_compare" / "data"
USER_SEEDS_DIR = APP_ROOT / "user_seeds" / "data"
RUNTIME_DATA_DIR = APP_ROOT / "data"

SCRAPER_ROOT = REPO_ROOT / "scraper"
SCRAPER_DATA = SCRAPER_ROOT / "data"
