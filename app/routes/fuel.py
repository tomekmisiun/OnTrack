from flask import Blueprint, jsonify, request
import requests
import re
from datetime import datetime, timedelta

fuel_bp = Blueprint('fuel', __name__)

_cache_pl = {'data': None, 'ts': 0}
_cache_en = {'data': None, 'ts': 0}

def _last_7am():
    now = datetime.now()
    today_7am = now.replace(hour=7, minute=0, second=0, microsecond=0)
    if now >= today_7am:
        return today_7am.timestamp()
    return (today_7am - timedelta(days=1)).timestamp()

def _fetch_pl():
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
    return prices

def _fetch_uk():
    # Step 1: get current CSV URL from gov.uk stats page
    stats_page = requests.get(
        'https://www.gov.uk/government/statistics/weekly-road-fuel-prices',
        headers={'User-Agent': 'Mozilla/5.0'},
        timeout=8
    )
    stats_page.raise_for_status()
    # Find the latest weekly CSV (not the historical 2003-2017 one)
    csv_urls = re.findall(
        r'href="(https://assets\.publishing\.service\.gov\.uk[^"]+weekly_road_fuel_prices_\d+\.csv)"',
        stats_page.text
    )
    if not csv_urls:
        raise ValueError('Could not find CSV URL on gov.uk')
    csv_url = csv_urls[0]

    # Step 2: download and parse CSV
    csv_resp = requests.get(csv_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
    csv_resp.raise_for_status()
    lines = [l.strip() for l in csv_resp.text.splitlines() if l.strip()]
    # Last non-empty line has most recent data; cols: date,ulsp_ppl,ulsd_ppl,...
    last = lines[-1].split(',')
    petrol_ppl = float(last[1])   # ULSP pence/litre
    diesel_ppl = float(last[2])   # ULSD pence/litre

    return {
        'benzyna': round(petrol_ppl / 100, 3),
        'diesel':  round(diesel_ppl / 100, 3),
    }

@fuel_bp.route('/prices', methods=['GET'])
def get_fuel_prices():
    lang = request.args.get('lang', 'pl')
    cache = _cache_en if lang == 'en' else _cache_pl

    if cache['data'] and cache['ts'] >= _last_7am():
        return jsonify(cache['data'])

    try:
        prices = _fetch_uk() if lang == 'en' else _fetch_pl()

        if not prices:
            return jsonify({'error': 'Could not fetch prices'}), 502

        cache['data'] = prices
        cache['ts'] = datetime.now().timestamp()
        return jsonify(prices)

    except Exception as e:
        return jsonify({'error': str(e)}), 502
