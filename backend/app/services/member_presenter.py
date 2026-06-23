from app.models.household_member import HouseholdMember


def member_to_dict(member: HouseholdMember) -> dict:
    return {
        "id": member.id,
        "name": member.name,
        "is_primary": member.is_primary,
        "gender": member.gender,
        "age": member.age,
        "weight": member.weight,
        "height": member.height,
        "activity": member.activity,
        "goal": member.goal,
        "macro_goals": {
            "kcal": member.macro_kcal,
            "protein": member.macro_protein,
            "fat": member.macro_fat,
            "carbs": member.macro_carbs,
            "goalLabel": member.macro_goal_label,
        }
        if member.macro_kcal
        else None,
    }
