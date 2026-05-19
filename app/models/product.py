from app import db

class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    package_weight = db.Column(db.Float, nullable=False)
    price = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(10), nullable=False, default='g')
    kcal = db.Column(db.Float, nullable=True)
    protein = db.Column(db.Float, nullable=True)
    fat = db.Column(db.Float, nullable=True)
    carbs = db.Column(db.Float, nullable=True)
    sold_by_weight = db.Column(db.Boolean, nullable=False, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'package_weight': self.package_weight,
            'price': self.price,
            'unit': self.unit,
            'kcal': self.kcal,
            'protein': self.protein,
            'fat': self.fat,
            'carbs': self.carbs,
            'sold_by_weight': bool(self.sold_by_weight),
        }
