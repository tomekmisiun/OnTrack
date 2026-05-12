from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS

db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)

    from app.routes.products import products_bp
    from app.routes.recipes import recipes_bp
    from app.routes.meal_plan import meal_plan_bp

    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(recipes_bp, url_prefix='/api/recipes')
    app.register_blueprint(meal_plan_bp, url_prefix='/api/meal-plan')

    return app