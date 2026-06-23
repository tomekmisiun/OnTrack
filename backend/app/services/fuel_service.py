"""Fuel price scraping with in-memory cache until 7:00 local."""

from __future__ import annotations

import re
from datetime import datetime, timedelta

import requests

_cache_pl: dict = {"data": None, "ts": 0}
_cache_en: dict = {"data": None, "ts": 0}


def _last_7am() -> float:
    now = datetime.now()
    today_7am = now.replace(hour=7, minute=0, second=0, microsecond=0)
    if now >= today_7am:
        return today_7am.timestamp()
    return (today_7am - timedelta(days=1)).timestamp()


def _fetch_pl() -> dict[str, float]:
    resp = requests.get(
        "https://www.autocentrum.pl/paliwa/ceny-paliw/",
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=8,
    )
    resp.raise_for_status()
    prices: dict[str, float] = {}
    for m in re.finditer(
        r'"description":"Średnia cena ([^"]+) w Polsce: ([\d.]+) zł/l"', resp.text
    ):
        name, price = m.group(1), float(m.group(2))
        if name == "95":
            prices["benzyna"] = price
        elif name == "ON":
            prices["diesel"] = price
        elif name == "LPG":
            prices["gaz"] = price
    return prices


def _fetch_uk() -> dict[str, float]:
    stats_page = requests.get(
        "https://www.gov.uk/government/statistics/weekly-road-fuel-prices",
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=8,
    )
    stats_page.raise_for_status()
    csv_urls = re.findall(
        r'href="(https://assets\.publishing\.service\.gov\.uk[^"]+weekly_road_fuel_prices_\d+\.csv)"',
        stats_page.text,
    )
    if not csv_urls:
        raise ValueError("Could not find CSV URL on gov.uk")
    csv_url = csv_urls[0]

    csv_resp = requests.get(csv_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
    csv_resp.raise_for_status()
    lines = [line.strip() for line in csv_resp.text.splitlines() if line.strip()]
    last = lines[-1].split(",")
    petrol_ppl = float(last[1])
    diesel_ppl = float(last[2])

    return {
        "benzyna": round(petrol_ppl / 100, 3),
        "diesel": round(diesel_ppl / 100, 3),
    }


def get_fuel_prices(lang: str = "pl") -> tuple[dict, int]:
    cache = _cache_en if lang == "en" else _cache_pl

    if cache["data"] and cache["ts"] >= _last_7am():
        return cache["data"], 200

    try:
        prices = _fetch_uk() if lang == "en" else _fetch_pl()
        if not prices:
            return {"error": "Could not fetch prices"}, 502

        cache["data"] = prices
        cache["ts"] = datetime.now().timestamp()
        return prices, 200
    except Exception as exc:
        return {"error": str(exc)}, 502
