from flask_jwt_extended import get_jwt_identity


def current_uid() -> int:
    return int(get_jwt_identity())
