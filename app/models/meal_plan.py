from app import db
from datetime import date

class MealPlan(db.Model):
    __tablename__ = 'meal_plans'

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    position = db.Column(db.Integer, nullable=False)  # 1-5, max 5 przepisów na dzień
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)

    recipe = db.relationship('Recipe')

    __table_args__ = (
        db.UniqueConstraint('date', 'position', name='unique_date_position'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'position': self.position,
            'recipe_id': self.recipe_id,
            'recipe': self.recipe.to_dict()
        }