from app import db
from datetime import date as date_type


class RecipeParseLog(db.Model):
    __tablename__ = 'recipe_parse_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    count = db.Column(db.Integer, default=0, nullable=False)

    __table_args__ = (db.UniqueConstraint('user_id', 'date', name='uq_recipe_parse_log'),)

    @classmethod
    def get_today_count(cls, user_id):
        row = cls.query.filter_by(user_id=user_id, date=date_type.today()).first()
        return row.count if row else 0

    @classmethod
    def increment(cls, user_id):
        from app import db as _db
        today = date_type.today()
        row = cls.query.filter_by(user_id=user_id, date=today).first()
        if row:
            row.count += 1
        else:
            _db.session.add(cls(user_id=user_id, date=today, count=1))
        _db.session.commit()
