from app import db


class HouseholdMember(db.Model):
    __tablename__ = 'household_members'

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name       = db.Column(db.String(80), nullable=False)
    is_primary = db.Column(db.Boolean, nullable=False, default=False)

    # Macro profile
    gender   = db.Column(db.String(1))
    age      = db.Column(db.Integer)
    weight   = db.Column(db.Float)
    height   = db.Column(db.Float)
    activity = db.Column(db.Float)
    goal     = db.Column(db.String(20))

    # Computed macro goals (saved after clicking "Zapisz jako cel")
    macro_kcal       = db.Column(db.Integer)
    macro_protein    = db.Column(db.Integer)
    macro_fat        = db.Column(db.Integer)
    macro_carbs      = db.Column(db.Integer)
    macro_goal_label = db.Column(db.String(50))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'is_primary': self.is_primary,
            'gender': self.gender,
            'age': self.age,
            'weight': self.weight,
            'height': self.height,
            'activity': self.activity,
            'goal': self.goal,
            'macro_goals': {
                'kcal': self.macro_kcal,
                'protein': self.macro_protein,
                'fat': self.macro_fat,
                'carbs': self.macro_carbs,
                'goalLabel': self.macro_goal_label,
            } if self.macro_kcal else None,
        }
