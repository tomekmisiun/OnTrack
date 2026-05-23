from app.utils import (
    default_primary_member_name,
    looks_like_recipe_ingredient_line,
    sync_primary_member_name,
)
from app.models.household_member import HouseholdMember
from app import db


def test_looks_like_recipe_ingredient_line():
    assert looks_like_recipe_ingredient_line("200 g mąki") is True
    assert looks_like_recipe_ingredient_line("Jogurt naturalny") is False


def test_default_primary_member_name():
    assert default_primary_member_name("pl") == "Ja"
    assert default_primary_member_name("en") == "Me"


def test_sync_primary_member_name(user):
    user.lang = "en"
    db.session.commit()
    primary = HouseholdMember.query.filter_by(user_id=user.id, is_primary=True).first()
    primary.name = "Me"
    db.session.commit()

    assert sync_primary_member_name(user) is False

    primary.name = "Ja"
    db.session.commit()
    assert sync_primary_member_name(user) is True
    assert primary.name == "Me"
