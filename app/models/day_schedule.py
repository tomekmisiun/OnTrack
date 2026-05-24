from app import db


class DayScheduleBlock(db.Model):
    __tablename__ = 'day_schedule_blocks'

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    member_id  = db.Column(db.Integer, db.ForeignKey('household_members.id'), nullable=False)
    day        = db.Column(db.Integer, nullable=False)       # 0=Mon … 6=Sun
    start_hour = db.Column(db.Integer, nullable=False)      # 0–23
    end_hour   = db.Column(db.Integer, nullable=False)      # exclusive, 1–24
    label      = db.Column(db.String(120), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'member_id': self.member_id,
            'day': self.day,
            'start_hour': self.start_hour,
            'end_hour': self.end_hour,
            'label': self.label,
        }
