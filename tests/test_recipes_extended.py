from app.models.recipe import Recipe
from app.gemini_client import is_gemini_overloaded


def test_is_gemini_overloaded_detects_503():
    assert is_gemini_overloaded(Exception("503 UNAVAILABLE. high demand"))
    assert not is_gemini_overloaded(Exception("invalid API key"))


def test_update_category(client, auth_headers, recipe):
    res = client.patch(
        f"/api/recipes/{recipe.id}/category",
        headers=auth_headers,
        json={"category": "dinner"},
    )
    assert res.status_code == 200
    assert res.get_json()["category"] == "dinner"


def test_delete_all_recipes(client, auth_headers, recipe):
    res = client.delete("/api/recipes/all", headers=auth_headers)
    assert res.status_code == 200
    assert Recipe.query.filter_by(user_id=recipe.user_id).count() == 0
