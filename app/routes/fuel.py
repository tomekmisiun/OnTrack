from flask import Blueprint, jsonify
import requests
import re
from datetime import datetime, timedelta

fuel_bp = Blueprint('fuel', __name__)

_cache = {'data': None, 'ts': 0}

def _last_7am():
    now = datetime.now()
    today_7am = now.replace(hour=7, minute=0, second=0, microsecond=0)
    if now >= today_7am:
        return today_7am.timestamp()
    return (today_7am - timedelta(days=1)).timestamp()

@fuel_bp.route('/prices', methods=['GET'])
def get_fuel_prices():
    if _cache['data'] and _cache['ts'] >= _last_7am():
        return jsonify(_cache['data'])

    try:
        resp = requests.get(
            'https://www.autocentrum.pl/paliwa/ceny-paliw/',
            headers={'User-Agent': 'Mozilla/5.0'},
            timeout=8
        )
        resp.raise_for_status()

        prices = {}
        for m in re.finditer(r'"description":"Średnia cena ([^"]+) w Polsce: ([\d.]+) zł/l"', resp.text):
            name, price = m.group(1), float(m.group(2))
            if name == '95':
                prices['benzyna'] = price
            elif name == 'ON':
                prices['diesel'] = price
            elif name == 'LPG':
                prices['gaz'] = price

        if not prices:
            return jsonify({'error': 'Nie udało się pobrać cen'}), 502

        _cache['data'] = prices
        _cache['ts'] = datetime.now().timestamp()
        return jsonify(prices)

    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 502
