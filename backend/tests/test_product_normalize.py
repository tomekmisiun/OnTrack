from app.domain.product_normalize import normalize_product_name


def test_normalize_product_name_strips_and_folded():
    assert normalize_product_name("  Jogurt Naturalny  ") == "jogurt naturalny"


def test_normalize_product_name_polish_diacritics():
    assert normalize_product_name("płatki owsiane") == "platki owsiane"
