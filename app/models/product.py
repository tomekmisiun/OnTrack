from app import db

class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    package_weight = db.Column(db.Float, nullable=False)  # gramatura opakowania w gramach
    price = db.Column(db.Float, nullable=False)  # cena opakowania

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'package_weight': self.package_weight,
            'price': self.price
        }