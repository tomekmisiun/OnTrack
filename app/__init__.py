from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    jwt.init_app(app)

    @jwt.unauthorized_loader
    def unauthorized(_err):
        return jsonify({'error': 'Wymagane logowanie'}), 401

    @jwt.invalid_token_loader
    def invalid_token(_err):
        return jsonify({'error': 'Nieprawidłowy token'}), 401

    @jwt.expired_token_loader
    def expired_token(_jwt_header, _jwt_data):
        return jsonify({'error': 'Sesja wygasła — zaloguj się ponownie'}), 401

    from prometheus_flask_exporter import PrometheusMetrics
    PrometheusMetrics(app)

    from app.routes.nutrition import nutrition_bp
    app.register_blueprint(nutrition_bp, url_prefix='/api/nutrition')

    from app.routes.auth import auth_bp, init_oauth
    init_oauth(app)
    from app.routes.products import products_bp
    from app.routes.recipes import recipes_bp
    from app.routes.meal_plan import meal_plan_bp
    from app.routes.import_prices import import_bp
    from app.routes.members import members_bp
    from app.routes.fuel import fuel_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(recipes_bp, url_prefix='/api/recipes')
    app.register_blueprint(meal_plan_bp, url_prefix='/api/meal-plan')
    app.register_blueprint(import_bp, url_prefix='/api/import')
    app.register_blueprint(members_bp, url_prefix='/api/members')
    app.register_blueprint(fuel_bp, url_prefix='/api/fuel')

    return app