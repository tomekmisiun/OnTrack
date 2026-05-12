from app import db

class RecipeIngredient(db.Model):
    __tablename__ = 'recipe_ingredients'

    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    weight = db.Column(db.Float, nullable=False)  # gramatura w przepisie

    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name,
            'package_weight': self.product.package_weight,
            'price_per_gram': self.product.price / self.product.package_weight,
            'weight': self.weight,
            'cost': round((self.weight / self.product.package_weight) * self.product.price, 2)
        }

class Recipe(db.Model):
    __tablename__ = 'recipes'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    ingredients = db.relationship('RecipeIngredient', backref='recipe', cascade='all, delete-orphan')

    def total_cost(self):
        return round(sum(i.to_dict()['cost'] for i in self.ingredients), 2)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'ingredients': [i.to_dict() for i in self.ingredients],
            'total_cost': self.total_cost()
        }