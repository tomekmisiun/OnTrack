from flask import Blueprint, request, jsonify, redirect, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from authlib.integrations.flask_client import OAuth
from app import db
from app.models.user import User
from app.models.auth_code import AuthCode
from app.utils import default_primary_member_name, sync_primary_member_name
from urllib.parse import urlencode
import os

auth_bp = Blueprint('auth', __name__)
oauth = OAuth()


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


def _find_or_create_oauth_user(email):
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email)
        user.set_password(os.urandom(32).hex())  # random password — OAuth-only account
        db.session.add(user)
        db.session.commit()
    return user


def _frontend_redirect(path_query: str):
    frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    return redirect(f'{frontend_url}/{path_query.lstrip("/")}')


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    from app.seeds import catalog_needs_repair, import_lang_from_pipeline
    if catalog_needs_repair(user.id, user.lang):
        import_lang_from_pipeline(user.id, user.lang, replace=True)
    sync_primary_member_name(user)
    return jsonify(user.to_dict())


@auth_bp.route('/exchange', methods=['POST'])
def exchange_code():
    data = request.get_json() or {}
    code = str(data.get('code', '')).strip()
    if not code:
        return jsonify({'error': 'Code is required'}), 400

    user = AuthCode.redeem(code)
    if not user:
        return jsonify({'error': 'Invalid or expired code'}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token})


# ---- Google OAuth ----

@auth_bp.route('/google')
def google_login():
    if not current_app.config.get('GOOGLE_CLIENT_ID'):
        return jsonify({'error': 'Google OAuth is not configured'}), 503
    redirect_uri = current_app.config['GOOGLE_REDIRECT_URI']
    pending_lang = request.args.get('lang') or request.cookies.get('pending_lang') or 'pl'
    if pending_lang not in ('pl', 'en'):
        pending_lang = 'pl'
    resp = oauth.google.authorize_redirect(redirect_uri)
    resp.set_cookie('pending_lang', pending_lang, max_age=300, httponly=True, samesite='Lax')
    return resp


@auth_bp.route('/google/callback')
def google_callback():
    try:
        token = oauth.google.authorize_access_token()
        user_info = token.get('userinfo') or oauth.google.userinfo()
        email = user_info.get('email', '').lower()
        if not email:
            return _frontend_redirect(f'?{urlencode({"auth_error": "No email returned from Google"})}')

        is_new = not User.query.filter_by(email=email).first()
        pending_lang = request.cookies.get('pending_lang') or 'pl'
        user = _find_or_create_oauth_user(email)
        if is_new:
            from app.seeds import seed_user
            from app.models.household_member import HouseholdMember
            lang = pending_lang if pending_lang in ('pl', 'en') else 'pl'
            user.lang = lang
            db.session.commit()
            seed_user(user.id, lang=lang)
            primary = HouseholdMember(user_id=user.id, name=default_primary_member_name(lang), is_primary=True)
            db.session.add(primary)
            db.session.commit()

        ttl = current_app.config.get('AUTH_CODE_TTL_SECONDS', 120)
        code = AuthCode.issue(user.id, ttl_seconds=ttl)
        return _frontend_redirect(f'?{urlencode({"code": code})}')
    except Exception:
        return _frontend_redirect(f'?{urlencode({"auth_error": "Login error"})}')


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

    from app.seeds import ensure_user_seeded
    ensure_user_seeded(user.id, lang)
    sync_primary_member_name(user)

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
