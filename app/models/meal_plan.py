from app import db
from datetime import date

class MealPlan(db.Model):
    __tablename__ = 'meal_plans'

    id        = db.Column(db.Integer, primary_key=True)
    user_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    member_id = db.Column(db.Integer, db.ForeignKey('household_members.id'), nullable=True)
    date      = db.Column(db.Date, nullable=False)
    position  = db.Column(db.Integer, nullable=False)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)

    recipe = db.relationship('Recipe')

    __table_args__ = (
        db.UniqueConstraint('member_id', 'date', 'position', name='unique_member_date_position'),
    )

    def to_dict(self, recipe_summary=False):
        if self.recipe is None:
            recipe_data = None
        elif recipe_summary:
            recipe_data = self.recipe.to_dict_summary()
        else:
            recipe_data = self.recipe.to_dict()
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'position': self.position,
            'recipe_id': self.recipe_id,
            'member_id': self.member_id,
            'recipe': recipe_data,
        }
