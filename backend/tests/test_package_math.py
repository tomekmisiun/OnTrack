"""Parity tests for package math used in summary and export shop lists."""

from __future__ import annotations

import pytest

from app.domain.package_math import (
    default_package_weight,
    package_line_costs,
    price_per_package,
)

PACKAGE_MATH_VECTORS = [
    {
        "label": "grams discrete packages",
        "unit": "g",
        "unit_price": 4.99,
        "package_weight": 500,
        "total_weight": 750,
        "sold_by_weight": False,
        "expected_price_per_package": 24.95,
        "expected": {
            "packages_exact": 1.5,
            "packages_rounded": 2,
            "total_cost": 49.9,
            "actual_cost": 37.42,
        },
    },
    {
        "label": "grams sold by weight",
        "unit": "g",
        "unit_price": 4.99,
        "package_weight": 500,
        "total_weight": 750,
        "sold_by_weight": True,
        "expected_price_per_package": 24.95,
        "expected": {
            "packages_exact": 1.5,
            "packages_rounded": 1.5,
            "total_cost": 37.42,
            "actual_cost": 37.42,
        },
    },
    {
        "label": "count discrete packages",
        "unit": "szt",
        "unit_price": 2.5,
        "package_weight": 6,
        "total_weight": 7,
        "sold_by_weight": False,
        "expected_price_per_package": 15,
        "expected": {
            "packages_exact": 1.17,
            "packages_rounded": 2,
            "total_cost": 30,
            "actual_cost": 17.5,
        },
    },
]


@pytest.mark.parametrize("case", PACKAGE_MATH_VECTORS, ids=lambda c: c["label"])
def test_package_math_vectors(case: dict) -> None:
    unit = case["unit"]
    pkg = default_package_weight(case["package_weight"], unit)
    package_price = price_per_package(
        unit_price=case["unit_price"],
        package_weight=pkg,
        unit=unit,
    )
    assert package_price == pytest.approx(case["expected_price_per_package"])

    costs = package_line_costs(
        total_weight=case["total_weight"],
        package_weight=pkg,
        price_per_package=package_price,
        sold_by_weight=case["sold_by_weight"],
    )
    for key, expected in case["expected"].items():
        assert costs[key] == pytest.approx(expected)


def test_default_package_weight_fallbacks() -> None:
    assert default_package_weight(None, "g") == 1000
    assert default_package_weight(0, "szt") == 1
