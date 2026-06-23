import re

_RECIPE_LINE = re.compile(
    r"(\d+\s*-\s*\d+|\d+\s*(g|ml|kg|l\b|szt|łyż|szkl|gram|centymetr|cm\b)|"
    r"u mnie|np\.|ulubion|świeżo wyciśni|według przepisu)",
    re.I,
)


def looks_like_recipe_ingredient_line(name: str) -> bool:
    """True when a product name looks like a raw recipe line, not a shop ingredient."""
    return bool(_RECIPE_LINE.search(name or ""))
