from app.import_names import translate_product_name


def test_translate_makaron_to_pasta_for_en():
    assert translate_product_name("makaron", "en") == "pasta"


def test_translate_leaves_polish_in_pl_catalog():
    assert translate_product_name("makaron", "pl") == "makaron"


def test_translate_leaves_english_unchanged():
    assert translate_product_name("pasta", "en") == "pasta"
