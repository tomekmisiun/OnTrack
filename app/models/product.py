from app import db

class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    package_weight = db.Column(db.Float, nullable=False)
    price = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(10), nullable=False, default='g')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'package_weight': self.package_weight,
            'price': self.price,
            'unit': self.unit,
        }
