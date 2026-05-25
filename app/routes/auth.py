from flask import Blueprint, request, jsonify, redirect, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from authlib.integrations.flask_client import OAuth
from app import db
from app.models.user import User
from app.models.auth_code import AuthCode
from app.utils import default_primary_member_name, sync_primary_member_name
from urllib.parse import urlencode
import os
import re
import threading

auth_bp = Blueprint('auth', __name__)
oauth = OAuth()

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{3,80}$')
MIN_PASSWORD_LEN = 8


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


def _auth_error_redirect(message: str):
    return _frontend_redirect(f'?{urlencode({"auth_error": message[:220]})}')


def _catalog_incomplete(user_id: int, lang: str) -> bool:
    from app.models.product import Product
    from app.models.recipe import Recipe

    has_products = Product.query.filter_by(user_id=user_id, lang=lang).filter(
        Product.price > 0
    ).first()
    has_recipes = Recipe.query.filter_by(user_id=user_id, lang=lang).first()
    return not has_products or not has_recipes


def _ensure_catalog_seeded(user_id: int, lang: str):
    """Load default catalog synchronously when missing (new accounts)."""
    if not _catalog_incomplete(user_id, lang):
        return
    try:
        from app.user_seeds import ensure_user_seeded
        ensure_user_seeded(user_id, lang)
    except Exception:
        current_app.logger.exception('Catalog seed failed for user %s', user_id)
        db.session.rollback()


def _schedule_catalog_seed(user_id: int, lang: str):
    """Backfill images / repair in background (skipped under pytest)."""
    if current_app.config.get('TESTING'):
        return

    app = current_app._get_current_object()

    def _run():
        with app.app_context():
            try:
                from app.user_seeds import ensure_user_seeded
                ensure_user_seeded(user_id, lang)
            except Exception:
                app.logger.exception('Background catalog seed failed for user %s', user_id)

    threading.Thread(target=_run, daemon=True, name=f'seed-{user_id}').start()


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    _ensure_catalog_seeded(user.id, user.lang)
    _schedule_catalog_seed(user.id, user.lang)
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
    secure = not current_app.config.get('FLASK_DEBUG')
    resp.set_cookie(
        'pending_lang', pending_lang, max_age=300, httponly=True,
        samesite='None' if secure else 'Lax', secure=secure,
    )
    return resp


def _ensure_primary_member(user, lang: str):
    from app.models.household_member import HouseholdMember
    if HouseholdMember.query.filter_by(user_id=user.id, is_primary=True).first():
        return
    db.session.add(
        HouseholdMember(
            user_id=user.id,
            name=default_primary_member_name(lang),
            is_primary=True,
        )
    )
    db.session.commit()


def _seed_new_user_catalog(user_id: int, lang: str):
    _ensure_catalog_seeded(user_id, lang)


def _synthetic_email(username: str) -> str:
    """Placeholder email for username-only accounts (users.email is NOT NULL)."""
    return f'{username}@users.ontrack.local'


def _is_synthetic_email(email: str) -> bool:
    return bool(email) and email.endswith('@users.ontrack.local')


def _normalize_username(raw: str) -> str:
    return (raw or '').strip().lower()


def _validate_username(username: str) -> str | None:
    if not USERNAME_RE.match(username):
        return 'Username must be 3–80 characters (letters, numbers, underscore only)'
    return None


def _validate_password(password: str) -> str | None:
    if len(password or '') < MIN_PASSWORD_LEN:
        return f'Password must be at least {MIN_PASSWORD_LEN} characters'
    return None


def _issue_jwt(user: User):
    return jsonify({'token': create_access_token(identity=str(user.id))})


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = _normalize_username(data.get('username'))
    password = data.get('password') or ''
    lang = data.get('lang') or 'pl'
    if lang not in ('pl', 'en'):
        lang = 'pl'

    err = _validate_username(username) or _validate_password(password)
    if err:
        return jsonify({'error': err}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 409

    email = _synthetic_email(username)
    user = User(email=email, username=username, lang=lang)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    _ensure_primary_member(user, lang)
    _seed_new_user_catalog(user.id, lang)
    _schedule_catalog_seed(user.id, lang)

    return _issue_jwt(user), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = _normalize_username(data.get('username'))
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401

    _ensure_catalog_seeded(user.id, user.lang)
    sync_primary_member_name(user)
    return _issue_jwt(user)


@auth_bp.route('/google/callback')
def google_callback():
    try:
        token = oauth.google.authorize_access_token()
        user_info = token.get('userinfo') or oauth.google.userinfo()
        email = user_info.get('email', '').lower()
        if not email:
            return _auth_error_redirect('No email returned from Google')

        pending_lang = request.cookies.get('pending_lang') or 'pl'
        lang = pending_lang if pending_lang in ('pl', 'en') else 'pl'
        is_new = not User.query.filter_by(email=email).first()
        user = _find_or_create_oauth_user(email)
        if is_new:
            user.lang = lang
            db.session.commit()
            _ensure_primary_member(user, lang)
            _seed_new_user_catalog(user.id, lang)
        else:
            _ensure_primary_member(user, user.lang or lang)

        ttl = current_app.config.get('AUTH_CODE_TTL_SECONDS', 120)
        code = AuthCode.issue(user.id, ttl_seconds=ttl)
        return _frontend_redirect(f'?{urlencode({"code": code})}')
    except Exception as e:
        current_app.logger.exception('Google OAuth callback failed')
        try:
            from authlib.integrations.base_client.errors import OAuthError
            if isinstance(e, OAuthError):
                desc = getattr(e, 'description', None) or str(getattr(e, 'error', e))
                return _auth_error_redirect(f'Google OAuth: {desc}')
        except ImportError:
            pass
        return _auth_error_redirect(f'{type(e).__name__}: {e}')


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
    _ensure_catalog_seeded(user.id, lang)
    _schedule_catalog_seed(user.id, lang)
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
    from app.models.day_schedule import DayScheduleBlock

    MealPlan.query.filter_by(user_id=uid).delete()
    DayScheduleBlock.query.filter_by(user_id=uid).delete()
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
