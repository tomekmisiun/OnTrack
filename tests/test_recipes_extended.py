from app.models.product import Product
from app.models.recipe import Recipe
from app.routes.recipes import _is_gemini_overloaded


def test_is_gemini_overloaded_detects_503():
    assert _is_gemini_overloaded(Exception("503 UNAVAILABLE. high demand"))
    assert not _is_gemini_overloaded(Exception("invalid API key"))


def test_parse_limit_returns_remaining(client, auth_headers):
    res = client.get("/api/recipes/parse-limit", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["daily_limit"] == 2
    assert data["remaining_today"] == 2
    assert "ai_available" in data


def test_parse_text_requires_recipe_body(client, auth_headers):
    res = client.post(
        "/api/recipes/parse-text",
        headers=auth_headers,
        json={"text": "hello world random text"},
    )
    assert res.status_code == 400
    assert "does not look like a recipe" in res.get_json()["error"]


def test_parse_text_requires_text(client, auth_headers):
    res = client.post("/api/recipes/parse-text", headers=auth_headers, json={})
    assert res.status_code == 400


def test_parse_text_without_gemini_key(client, auth_headers, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    res = client.post(
        "/api/recipes/parse-text",
        headers=auth_headers,
        json={"text": "Owsianka\n200 g płatków owsianych\n300 ml mleka"},
    )
    assert res.status_code == 503
    assert res.get_json()["code"] == "gemini_not_configured"


def test_parse_text_accepts_english_ingredients(client, auth_headers, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    res = client.post(
        "/api/recipes/parse-text",
        headers=auth_headers,
        json={
            "text": (
                "1 cup soy sauce\n"
                "1 cup brown sugar\n"
                "1 onion, chopped\n"
                "1 tablespoon grated fresh ginger root\n"
                "5 pounds skinless chicken thighs"
            ),
        },
    )
    assert res.status_code == 503
    assert res.get_json()["code"] == "gemini_not_configured"


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
