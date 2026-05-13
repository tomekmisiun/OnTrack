from app import db
from datetime import date

class MealPlan(db.Model):
    __tablename__ = 'meal_plans'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    position = db.Column(db.Integer, nullable=False)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)

    recipe = db.relationship('Recipe')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'date', 'position', name='unique_user_date_position'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'position': self.position,
            'recipe_id': self.recipe_id,
            'recipe': self.recipe.to_dict(),
        }
