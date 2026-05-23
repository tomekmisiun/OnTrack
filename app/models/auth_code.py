from datetime import datetime, timedelta

import secrets

from app import db


class AuthCode(db.Model):
    __tablename__ = 'auth_codes'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship('User', backref=db.backref('auth_codes', lazy='dynamic'))

    @staticmethod
    def cleanup_expired():
        now = datetime.utcnow()
        AuthCode.query.filter(
            db.or_(AuthCode.expires_at < now, AuthCode.used_at.isnot(None))
        ).delete(synchronize_session=False)

    @staticmethod
    def issue(user_id: int, ttl_seconds: int = 120) -> str:
        AuthCode.cleanup_expired()
        code = secrets.token_urlsafe(32)
        row = AuthCode(
            code=code,
            user_id=user_id,
            expires_at=datetime.utcnow() + timedelta(seconds=ttl_seconds),
        )
        db.session.add(row)
        db.session.commit()
        return code

    @staticmethod
    def redeem(code: str):
        if not code or len(code) > 64:
            return None
        now = datetime.utcnow()
        row = AuthCode.query.filter_by(code=code).first()
        if not row or row.used_at or row.expires_at < now:
            return None
        row.used_at = now
        db.session.commit()
        return row.user
