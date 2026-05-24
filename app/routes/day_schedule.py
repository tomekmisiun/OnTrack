from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models.day_schedule import DayScheduleBlock
from app.models.household_member import HouseholdMember
from app.utils import current_uid
from datetime import date, timedelta

day_schedule_bp = Blueprint('day_schedule', __name__)


def resolve_member_id(uid, member_id=None):
    if member_id:
        m = HouseholdMember.query.filter_by(id=int(member_id), user_id=uid).first()
        if m:
            return m.id
    primary = HouseholdMember.query.filter_by(user_id=uid, is_primary=True).first()
    return primary.id if primary else None


def parse_week_start(value):
    if not value:
        return None
    try:
        d = date.fromisoformat(value)
    except ValueError:
        return None
    # Normalize to Monday
    monday = d - timedelta(days=(d.weekday()))
    return monday


def _block_for_user(block_id, uid):
    return DayScheduleBlock.query.filter_by(id=block_id, user_id=uid).first()


def _has_overlap(uid, mid, week_start, day, start_hour, end_hour):
    return DayScheduleBlock.query.filter(
        DayScheduleBlock.user_id == uid,
        DayScheduleBlock.member_id == mid,
        DayScheduleBlock.week_start == week_start,
        DayScheduleBlock.day == day,
        DayScheduleBlock.start_hour < end_hour,
        DayScheduleBlock.end_hour > start_hour,
    ).first()


def _validate_hours(start_hour, end_hour):
    if not (0 <= start_hour <= 23):
        return False
    if not (1 <= end_hour <= 24) or end_hour <= start_hour:
        return False
    return True


@day_schedule_bp.route('/', methods=['GET'])
@jwt_required()
def get_blocks():
    uid = current_uid()
    mid = resolve_member_id(uid, request.args.get('member_id'))
    if not mid:
        return jsonify([])

    week_start = parse_week_start(request.args.get('week_start'))
    if not week_start:
        return jsonify({'error': 'Invalid or missing week_start'}), 400

    blocks = DayScheduleBlock.query.filter_by(
        user_id=uid, member_id=mid, week_start=week_start
    ).order_by(DayScheduleBlock.day, DayScheduleBlock.start_hour).all()
    return jsonify([b.to_dict() for b in blocks])


@day_schedule_bp.route('/', methods=['POST'])
@jwt_required()
def create_block():
    uid = current_uid()
    data = request.get_json() or {}

    try:
        day = int(data['day'])
        start_hour = int(data['start_hour'])
        end_hour = int(data['end_hour'])
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'Invalid day or hour range'}), 400

    week_start = parse_week_start(data.get('week_start'))
    if not week_start:
        return jsonify({'error': 'Invalid or missing week_start'}), 400

    label = (data.get('label') or '').strip()
    if not label:
        return jsonify({'error': 'Label is required'}), 400
    if not (0 <= day <= 6):
        return jsonify({'error': 'Day must be 0–6'}), 400
    if not _validate_hours(start_hour, end_hour):
        return jsonify({'error': 'Invalid hour range'}), 400

    mid = resolve_member_id(uid, data.get('member_id'))
    if not mid:
        return jsonify({'error': 'Member not found'}), 404

    if _has_overlap(uid, mid, week_start, day, start_hour, end_hour):
        return jsonify({'error': 'Overlapping activity'}), 409

    block = DayScheduleBlock(
        user_id=uid,
        member_id=mid,
        week_start=week_start,
        day=day,
        start_hour=start_hour,
        end_hour=end_hour,
        label=label[:120],
    )
    db.session.add(block)
    db.session.commit()
    return jsonify(block.to_dict()), 201


@day_schedule_bp.route('/bulk', methods=['POST'])
@jwt_required()
def create_bulk():
    uid = current_uid()
    data = request.get_json() or {}

    try:
        start_hour = int(data['start_hour'])
        end_hour = int(data['end_hour'])
        days = [int(d) for d in data.get('days', [])]
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'Invalid payload'}), 400

    week_start = parse_week_start(data.get('week_start'))
    if not week_start:
        return jsonify({'error': 'Invalid or missing week_start'}), 400

    label = (data.get('label') or '').strip()
    if not label:
        return jsonify({'error': 'Label is required'}), 400
    if not _validate_hours(start_hour, end_hour):
        return jsonify({'error': 'Invalid hour range'}), 400
    if not days or any(d < 0 or d > 6 for d in days):
        return jsonify({'error': 'Invalid days'}), 400

    mid = resolve_member_id(uid, data.get('member_id'))
    if not mid:
        return jsonify({'error': 'Member not found'}), 404

    created = []
    skipped = []
    for day in sorted(set(days)):
        if _has_overlap(uid, mid, week_start, day, start_hour, end_hour):
            skipped.append(day)
            continue
        block = DayScheduleBlock(
            user_id=uid,
            member_id=mid,
            week_start=week_start,
            day=day,
            start_hour=start_hour,
            end_hour=end_hour,
            label=label[:120],
        )
        db.session.add(block)
        created.append(block)

    if created:
        db.session.commit()
        return jsonify({
            'created': [b.to_dict() for b in created],
            'skipped': skipped,
        }), 201

    return jsonify({'created': [], 'skipped': skipped}), 200


@day_schedule_bp.route('/<int:block_id>', methods=['PATCH'])
@jwt_required()
def update_block(block_id):
    uid = current_uid()
    block = _block_for_user(block_id, uid)
    if not block:
        return jsonify({'error': 'Not found'}), 404

    data = request.get_json() or {}
    label = (data.get('label') or '').strip()
    if not label:
        return jsonify({'error': 'Label is required'}), 400

    block.label = label[:120]
    db.session.commit()
    return jsonify(block.to_dict())


@day_schedule_bp.route('/<int:block_id>', methods=['DELETE'])
@jwt_required()
def delete_block(block_id):
    uid = current_uid()
    block = _block_for_user(block_id, uid)
    if not block:
        return jsonify({'error': 'Not found'}), 404

    db.session.delete(block)
    db.session.commit()
    return jsonify({'ok': True})
