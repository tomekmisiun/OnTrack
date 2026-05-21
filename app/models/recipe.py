from app import db

class RecipeIngredient(db.Model):
    __tablename__ = 'recipe_ingredients'

    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    weight = db.Column(db.Float, nullable=False)

    product = db.relationship('Product')

    def to_dict(self):
        price = self.product.price or 0  # per 100g / per 100ml / per szt
        unit = self.product.unit or 'g'
        if unit == 'szt':
            cost = round(self.weight * price, 2)
        else:
            cost = round((self.weight / 100) * price, 2)
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name,
            'package_weight': self.product.package_weight,
            'unit': unit,
            'kcal': self.product.kcal,
            'protein': self.product.protein,
            'fat': self.product.fat,
            'carbs': self.product.carbs,
            'weight': self.weight,
            'cost': cost,
        }

class Recipe(db.Model):
    __tablename__ = 'recipes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    is_favorite = db.Column(db.Boolean, nullable=False, default=False)
    image_url = db.Column(db.Text, nullable=True)
    source_url = db.Column(db.Text, nullable=True)
    kcal_100g = db.Column(db.Float, nullable=True)
    protein_100g = db.Column(db.Float, nullable=True)
    fat_100g = db.Column(db.Float, nullable=True)
    carbs_100g = db.Column(db.Float, nullable=True)
    ingredients = db.relationship('RecipeIngredient', backref='recipe', cascade='all, delete-orphan')

    def total_cost(self):
        return round(sum(i.to_dict()['cost'] for i in self.ingredients), 2)

    def _total_weight(self):
        return sum(
            i.weight for i in self.ingredients
            if i.product and i.product.unit != 'szt'
        )

    def _calc_macros(self):
        # Jeśli mamy makra per 100g z przepisu (aniagotuje), użyj ich × łączna waga
        if self.kcal_100g is not None:
            total = self._total_weight()
            factor = total / 100.0
            return (
                round(self.kcal_100g    * factor),
                round((self.protein_100g or 0) * factor, 1),
                round((self.fat_100g    or 0) * factor, 1),
                round((self.carbs_100g  or 0) * factor, 1),
            )
        # Fallback: suma makr ze składników
        kcal = protein = fat = carbs = 0.0
        for ing in self.ingredients:
            p = ing.product
            if not p or p.unit == 'szt':
                continue
            factor = ing.weight / 100.0
            kcal    += (p.kcal    or 0) * factor
            protein += (p.protein or 0) * factor
            fat     += (p.fat     or 0) * factor
            carbs   += (p.carbs   or 0) * factor
        return round(kcal), round(protein, 1), round(fat, 1), round(carbs, 1)

    def to_dict_summary(self):
        """Tylko nagłówek przepisu — bez składników. Używany w liście."""
        return {
            'id': self.id,
            'name': self.name,
            'notes': self.notes,
            'is_favorite': bool(self.is_favorite),
            'ingredients': [],
            'total_cost': 0,
            'total_kcal': 0,
            'total_protein': 0,
            'total_fat': 0,
            'total_carbs': 0,
            'kcal_100g': self.kcal_100g,
            'protein_100g': self.protein_100g,
            'fat_100g': self.fat_100g,
            'carbs_100g': self.carbs_100g,
            'image_url': self.image_url,
            'source_url': self.source_url,
        }

    def to_dict(self):
        kcal, protein, fat, carbs = self._calc_macros()
        return {
            'id': self.id,
            'name': self.name,
            'notes': self.notes,
            'is_favorite': bool(self.is_favorite),
            'ingredients': [i.to_dict() for i in self.ingredients],
            'total_cost': self.total_cost(),
            'total_kcal': kcal,
            'total_protein': protein,
            'total_fat': fat,
            'total_carbs': carbs,
            'image_url': self.image_url,
            'source_url': self.source_url,
        }
