from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models.household_member import HouseholdMember
from app.utils import current_uid

members_bp = Blueprint('members', __name__)

MAX_MEMBERS = 10
MAX_NAME = 80


def _own_member(member_id, uid):
    return HouseholdMember.query.filter_by(id=member_id, user_id=uid).first_or_404()


@members_bp.route('/', methods=['GET'])
@jwt_required()
def list_members():
    uid = current_uid()
    members = HouseholdMember.query.filter_by(user_id=uid).order_by(HouseholdMember.id).all()
    return jsonify([m.to_dict() for m in members])


@members_bp.route('/', methods=['POST'])
@jwt_required()
def create_member():
    uid = current_uid()
    if HouseholdMember.query.filter_by(user_id=uid).count() >= MAX_MEMBERS:
        return jsonify({'error': f'Maksymalna liczba członków: {MAX_MEMBERS}'}), 400

    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()[:MAX_NAME]
    if not name:
        return jsonify({'error': 'Nazwa wymagana'}), 400

    member = HouseholdMember(user_id=uid, name=name, is_primary=False)
    db.session.add(member)
    db.session.commit()
    return jsonify(member.to_dict()), 201


@members_bp.route('/<int:mid>', methods=['PATCH'])
@jwt_required()
def rename_member(mid):
    uid = current_uid()
    member = _own_member(mid, uid)
    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()[:MAX_NAME]
    if not name:
        return jsonify({'error': 'Nazwa wymagana'}), 400
    member.name = name
    db.session.commit()
    return jsonify(member.to_dict())


@members_bp.route('/<int:mid>', methods=['DELETE'])
@jwt_required()
def delete_member(mid):
    uid = current_uid()
    member = _own_member(mid, uid)
    if member.is_primary:
        return jsonify({'error': 'Nie można usunąć głównego członka'}), 403
    db.session.delete(member)
    db.session.commit()
    return jsonify({'message': 'Usunięto'}), 200


@members_bp.route('/<int:mid>/profile', methods=['PATCH'])
@jwt_required()
def save_profile(mid):
    uid = current_uid()
    member = _own_member(mid, uid)
    data = request.get_json() or {}

    for field in ('gender', 'activity', 'goal'):
        if field in data:
            setattr(member, field, data[field])

    for field in ('age', 'weight', 'height', 'macro_kcal', 'macro_protein', 'macro_fat', 'macro_carbs'):
        if field in data and data[field] is not None:
            try:
                setattr(member, field, int(data[field]) if field in ('age', 'macro_kcal', 'macro_protein', 'macro_fat', 'macro_carbs') else float(data[field]))
            except (TypeError, ValueError):
                pass

    if 'macro_goal_label' in data:
        member.macro_goal_label = str(data['macro_goal_label'])[:50]

    db.session.commit()
    return jsonify(member.to_dict())
