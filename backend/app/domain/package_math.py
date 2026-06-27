"""Package weight and shopping-list cost calculations."""

from __future__ import annotations

import math


def default_package_weight(package_weight: float | None, unit: str) -> float:
    if package_weight:
        return float(package_weight)
    return 1.0 if unit == "szt" else 1000.0


def price_per_package(*, unit_price: float, package_weight: float, unit: str) -> float:
    if unit == "szt":
        return unit_price * package_weight
    return unit_price * package_weight / 100


def _round2(value: float) -> float:
    """Half-up to 2 decimals — matches JavaScript Math.round(x * 100) / 100."""
    return math.floor(value * 100 + 0.5) / 100


def package_line_costs(
    *,
    total_weight: float,
    package_weight: float,
    price_per_package: float,
    sold_by_weight: bool,
) -> dict[str, float]:
    packages_exact = total_weight / package_weight
    actual_cost = packages_exact * price_per_package
    if sold_by_weight:
        packages_rounded = packages_exact
        total_cost = actual_cost
    else:
        packages_rounded = math.ceil(packages_exact)
        total_cost = packages_rounded * price_per_package
    return {
        "packages_exact": _round2(packages_exact),
        "packages_rounded": _round2(packages_rounded),
        "total_cost": _round2(total_cost),
        "actual_cost": _round2(actual_cost),
    }
