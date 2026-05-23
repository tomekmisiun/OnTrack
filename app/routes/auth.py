from flask import Blueprint, request, jsonify, redirect, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from authlib.integrations.flask_client import OAuth
from app import db
from app.models.user import User
import re
import os

auth_bp = Blueprint('auth', __name__)
oauth = OAuth()

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def init_oauth(app):
    oauth.init_app(app)
    if app.config.get('GOOGLE_CLIENT_ID'):
        oauth.register(
            name='google',
            client_id=app.config['GOOGLE_CLIENT_ID'],
            client_secret=app.config['GOOGLE_CLIENT_SECRET'],
            server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
            client_kwargs={'scope': 'openid email'},
        )


def _validate(email, password):
    if not email or not password:
        return 'Email and password are required'
    if not EMAIL_RE.match(email):
        return 'Invalid email format'
    if len(password) < 8:
        return 'Password must be at least 8 characters'
    return None


def _find_or_create_oauth_user(email):
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email)
        user.set_password(os.urandom(32).hex())  # random password — OAuth-only account
        db.session.add(user)
        db.session.commit()
    return user


# ---- Email/password ----

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    lang = data.get('lang', 'pl') if data.get('lang') in ('pl', 'en') else 'pl'

    err = _validate(email, password)
    if err:
        return jsonify({'error': err}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists'}), 409

    user = User(email=email, lang=lang)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    from app.seeds import seed_user
    seed_user(user.id, lang=lang)

    from app.models.household_member import HouseholdMember
    primary = HouseholdMember(user_id=user.id, name='Me' if lang == 'en' else 'Ja', is_primary=True)
    db.session.add(primary)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'access_token': token, 'user': user.to_dict()}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({'access_token': token, 'user': user.to_dict()})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict())


# ---- Google OAuth ----

@auth_bp.route('/google')
def google_login():
    if not current_app.config.get('GOOGLE_CLIENT_ID'):
        return jsonify({'error': 'Google OAuth is not configured'}), 503
    callback_url = current_app.config['FRONTEND_URL'].rstrip('/') + '/api/auth/google/callback'
    redirect_uri = f"http://localhost:5001/api/auth/google/callback"
    return oauth.google.authorize_redirect(redirect_uri)


@auth_bp.route('/google/callback')
def google_callback():
    frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
    try:
        token = oauth.google.authorize_access_token()
        user_info = token.get('userinfo') or oauth.google.userinfo()
        email = user_info.get('email', '').lower()
        if not email:
            return redirect(f'{frontend_url}?auth_error=No+email+returned+from+Google')

        is_new = not User.query.filter_by(email=email).first()
        # Read pending_lang from cookie (set by frontend before OAuth redirect)
        pending_lang = request.cookies.get('pending_lang') or 'pl'
        user = _find_or_create_oauth_user(email)
        if is_new:
            from app.seeds import seed_user
            from app.models.household_member import HouseholdMember
            lang = pending_lang if pending_lang in ('pl', 'en') else 'pl'
            user.lang = lang
            db.session.commit()
            seed_user(user.id, lang=lang)
            primary = HouseholdMember(user_id=user.id, name='Me' if lang == 'en' else 'Ja', is_primary=True)
            db.session.add(primary)
            db.session.commit()
        jwt_token = create_access_token(identity=str(user.id))
        return redirect(f'{frontend_url}?token={jwt_token}')
    except Exception as e:
        return redirect(f'{frontend_url}?auth_error=Login+error')


@auth_bp.route('/language', methods=['PATCH'])
@jwt_required()
def change_language():
    uid = int(get_jwt_identity())
    data = request.get_json() or {}
    lang = data.get('lang')
    if lang not in ('pl', 'en'):
        return jsonify({'error': 'Invalid language'}), 400
    user = User.query.get(uid)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user.lang = lang
    db.session.commit()
    return jsonify(user.to_dict())


@auth_bp.route('/me', methods=['DELETE'])
@jwt_required()
def delete_me():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    from app.models.meal_plan import MealPlan
    from app.models.recipe import Recipe, RecipeIngredient
    from app.models.product import Product
    from app.models.import_log import ImportLog
    from app.models.recipe_parse_log import RecipeParseLog
    from app.models.household_member import HouseholdMember

    MealPlan.query.filter_by(user_id=uid).delete()
    HouseholdMember.query.filter_by(user_id=uid).delete()
    recipe_ids = [r.id for r in Recipe.query.filter_by(user_id=uid).all()]
    if recipe_ids:
        RecipeIngredient.query.filter(RecipeIngredient.recipe_id.in_(recipe_ids)).delete(synchronize_session=False)
    Recipe.query.filter_by(user_id=uid).delete()
    Product.query.filter_by(user_id=uid).delete()
    ImportLog.query.filter_by(user_id=uid).delete()
    RecipeParseLog.query.filter_by(user_id=uid).delete()
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Account deleted'}), 200


@auth_bp.route('/providers')
def providers():
    """Returns which OAuth providers are configured."""
    available = []
    if current_app.config.get('GOOGLE_CLIENT_ID'):
        available.append('google')
    return jsonify({'providers': available})
