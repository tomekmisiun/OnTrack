import pytest

from app.services.macro_lookup import (
    dedup_key,
    lookup_macros,
    validate_macros,
    _get_macro_maps,
)


def test_validate_macros_accepts_schab_values():
    assert validate_macros(242, 27.3, 14.4, 0) is True


def test_validate_macros_rejects_absurd_kcal():
    assert validate_macros(1200, 10, 5, 20) is False


def test_lookup_schab_from_local_database():
    _get_macro_maps()
    result = lookup_macros('schab', 'pl')
    assert result['found'] is True
    assert result['source'] == 'database'
    assert result['kcal'] == 242.0
    assert result['protein'] == 27.3


def test_lookup_pork_loin_from_local_database_en():
    _get_macro_maps()
    result = lookup_macros('pork loin', 'en')
    assert result['found'] is True
    assert result['source'] == 'database'
    assert result['kcal'] == 242.0


def test_dedup_key_strips_polish_diacritics():
    assert dedup_key('Bułka') == dedup_key('bulka')


def test_lookup_empty_name():
    result = lookup_macros('', 'pl')
    assert result['found'] is False
