"""
Uzupełnia wartości odżywcze (kcal, białko, tłuszcz, węglowodany) dla produktów
w bazie danych, które mają NULL w tych polach.

Źródło danych: OpenFoodFacts (open-source, bez klucza API, dane dla PL).

Użycie:
    # Podgląd — pokaż dopasowania bez zapisywania:
    python fill_macros.py --dry-run

    # Uzupełnij makro dla wszystkich produktów bez danych:
    python fill_macros.py

    # Tylko dla konkretnego użytkownika:
    python fill_macros.py --user-id 2

    # Wszystkich użytkowników:
    python fill_macros.py --all-users

    # Pokaż co zostało już uzupełnione:
    python fill_macros.py --stats
"""

import re
import sys
import json
import time
import random
import argparse
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

import psycopg2

DB_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "mealplanner",
    "user":     "user",
    "password": "password",
}

DEFAULT_USER_ID = 2
MIN_MATCH_SCORE = 0.4

OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"

HEADERS = {
    "User-Agent": "MealPlannerApp/1.0 (personal nutrition tracker; contact: github)",
}


# ── OpenFoodFacts ─────────────────────────────────────────────────────────────

def normalize(text: str) -> str:
    t = text.lower()
    for a, b in [("ą","a"),("ć","c"),("ę","e"),("ł","l"),
                 ("ń","n"),("ó","o"),("ś","s"),("ź","z"),("ż","z")]:
        t = t.replace(a, b)
    return re.sub(r"[^a-z0-9 ]", " ", t).strip()


PL_STOPWORDS = {"w", "z", "i", "na", "ze", "do", "lub", "oraz", "a", "o",
                "po", "przy", "dla", "bez", "nad", "pod", "przez", "jak",
                "the", "and", "with", "in", "of", "from", "to",
                # rozmiary i ogólne opisy
                "mini", "maxi", "maly", "duzy", "sredni", "male", "duze",
                "klasyczny", "classic", "original", "nowy", "new",
                "extra", "light", "lite", "premium", "super", "bio", "eko",
                "polski", "polskie", "polska", "swojski", "domowy",
                "tradycyjny", "naturalny", "wiejski", "ekologiczny",
                # kolory
                "zolty", "zolta", "czerwony", "czerwona", "zielony", "zielona",
                "bialy", "biala", "czarny", "czarna", "rozowy", "rozowa",
                "niebieski", "fioletowy", "pomaranczowy", "brazowy",
                # kalibry/gatunki
                "kaliber", "kalibrze", "gatunek", "klasa", "typ", "rodzaj",
                "bezpestkowy", "pestkowy", "siatka", "luzem", "waga",
                # ogólne słowa opisowe
                "swiezy", "mrożony", "pieczony", "gotowany", "surowy",
                "caly", "cale", "male", "duze", "plasterki", "plastry",
                "kostki", "kawałki", "kawalki", "plat", "filet"}

# Grupy typów — oryginał i dopasowanie muszą mieć zgodny typ
FOOD_TYPE_GROUPS = [
    {"dzem", "dżem", "konfitury", "konfitura", "marmolada"},
    {"mus", "puree", "przecier"},
    {"sok", "nectar", "nektar", "juice"},
    {"serek", "twarozek"},
    {"jogurt"},
    {"ser", "cheese"},      # ser żółty, ser biały itp.
    {"makaron", "spaghetti", "penne", "fusilli", "tagliatelle", "fettuccine"},
    {"kasza", "grits"},
    {"maka", "flour"},
    {"olej", "oliwa"},
    {"chleb", "bread", "bulka"},
]


def types_compatible(query_name: str, candidate_name: str) -> bool:
    """Zwraca False jeśli produkty należą do różnych grup typów żywności."""
    qn = normalize(query_name)
    cn = normalize(candidate_name)
    for group in FOOD_TYPE_GROUPS:
        q_has = any(t in qn for t in group)
        c_has = any(t in cn for t in group)
        if q_has != c_has:
            return False

    # Jeśli zapytanie to 1-2 słowa kluczowe (np. samo "Arbuz"),
    # kandydat nie może mieć więcej niż 2 różnych owoców/warzyw (produkty mieszane)
    q_key = [w for w in normalize(query_name).split() if w not in PL_STOPWORDS and len(w) >= 4]
    if len(q_key) <= 2:
        c_key = [w for w in normalize(candidate_name).split() if w not in PL_STOPWORDS and len(w) >= 4]
        # Ile słów z kandydata NIE pasuje do zapytania?
        q_set = set(q_key)
        unrelated = [w for w in c_key if w not in q_set]
        if len(unrelated) >= len(q_key) + 1:   # kandydat ma dużo więcej słów niż zapytanie
            return False
    return True


def content_words(text: str) -> set[str]:
    """Zwraca słowa znaczące (bez stopwords, min 2 znaki)."""
    return {w for w in normalize(text).split() if w not in PL_STOPWORDS and len(w) >= 2}


def word_overlap(query: str, candidate: str) -> float:
    """F1-score na słowach znaczących. Zapobiega fałszywym trafieniom."""
    q_words = content_words(query)
    c_words = content_words(candidate)
    if not q_words or not c_words:
        return 0.0
    common = len(q_words & c_words)
    if common == 0:
        return 0.0
    precision = common / len(q_words)
    recall    = common / len(c_words)
    return 2 * precision * recall / (precision + recall)


# Znane marki/słowa do usunięcia przed wyszukiwaniem
BRAND_WORDS = re.compile(
    r"\b(zott|hortex|danone|mlekovita|piątnica|łaciata|mleczna dolina|OSM|"
    r"proste historie|new one|collection|premium|tradycyjne|domowe|swojskie|"
    r"wiejskie|naturalne|ekologiczne|bio|extra|lite|light|bez laktozy|"
    r"high protein|polski|polska|polskie)\b",
    re.IGNORECASE
)


def build_queries(product_name: str) -> list[str]:  # noqa: C901
    """
    Zwraca listę zapytań do wypróbowania, od najbardziej szczegółowego
    do najbardziej ogólnego.
    """
    queries = []

    # Specjalny wzorzec: "100% [owoc] z regionu..." → szukaj jako dżem
    if re.match(r"100%?\s+\w", product_name, re.IGNORECASE):
        fruit_match = re.search(
            r"\b(truskawka|malina|wiśnia|czarna porzeczka|porzeczka|jabłko|"
            r"brzoskwinia|morela|śliwka|czereśnia|żurawina|borówka|jagoda|"
            r"agrest|gruszka|mango|ananas|winogrono)\b",
            product_name, re.IGNORECASE
        )
        if fruit_match:
            queries.append(f"dżem {fruit_match.group(0).lower()}")
            queries.append(f"konfitura {fruit_match.group(0).lower()}")

    # 1. Usuń % i liczby-z-procentem
    base = re.sub(r"\d+[,.]?\d*\s*%", "", product_name)
    base = re.sub(r"\s{2,}", " ", base).strip()

    # 2. Pełna nazwa bez marek — pierwsze 5 słów
    no_brand = BRAND_WORDS.sub("", base)
    no_brand = re.sub(r"\s{2,}", " ", no_brand).strip()
    if no_brand:
        queries.append(" ".join(no_brand.split()[:5]))

    # 3. Pierwsze 3 słowa oryginalnej nazwy (często: marka + typ produktu)
    words = base.split()
    if len(words) >= 3:
        queries.append(" ".join(words[:3]))

    # 4. Ostatnie 3 słowa (często opisują produkt, nie markę)
    if len(words) >= 3:
        queries.append(" ".join(words[-3:]))

    # 5. Środkowe słowa (usuń pierwsze i ostatnie — zazwyczaj marka i wariant)
    if len(words) >= 4:
        queries.append(" ".join(words[1:-1]))

    # 5. Pierwsze 1-2 słowa kluczowe z nazwy (zachowaj oryginalną kolejność)
    key_ordered = [w for w in normalize(base).split()
                   if w not in PL_STOPWORDS and len(w) >= 4]
    if key_ordered:
        queries.insert(1, key_ordered[0])                           # np. "ananas", "awokado"
    if len(key_ordered) >= 2:
        queries.insert(2, f"{key_ordered[0]} {key_ordered[1]}")     # np. "ananas zolty"

    # 6. Poszczególne słowa kluczowe jako ostatni fallback
    for w in key_ordered[:3]:
        queries.append(w)

    # Deduplikuj zachowując kolejność, min. 2 znaki
    seen = set()
    result = []
    for q in queries:
        q = q.strip()
        if q and len(q) >= 2 and q not in seen:
            seen.add(q)
            result.append(q)
    return result


def _query_off(query: str, global_search: bool = False) -> list[dict]:
    p = {
        "search_terms":  query,
        "search_simple": 1,
        "action":        "process",
        "json":          1,
        "page_size":     10,
        "fields":        "product_name,nutriments,product_name_pl",
    }
    if not global_search:
        p["lc"] = "pl"
        p["cc"] = "pl"
    try:
        req = urllib.request.Request(OFF_SEARCH_URL + "?" + urllib.parse.urlencode(p), headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8")).get("products", [])
    except Exception:
        return []


def search_off(product_name: str) -> dict | None:
    """
    Szuka produktu w OpenFoodFacts próbując kilku zapytań (pełna nazwa,
    bez marki, ostatnie słowa, środkowe słowa). Zwraca najlepsze dopasowanie
    z kcal/białko/tłuszcz/węglowodany na 100g lub None.
    """
    queries = build_queries(product_name)
    best = None
    best_score = 0.0

    def try_query(query: str, global_search: bool = False) -> None:
        nonlocal best, best_score
        products = _query_off(query, global_search)
        for p in products:
            name = p.get("product_name_pl") or p.get("product_name") or ""
            n    = p.get("nutriments", {})
            kcal = n.get("energy-kcal_100g")
            if kcal is None:
                continue
            if not types_compatible(product_name, name):
                continue
            score = word_overlap(product_name, name)
            if score > best_score:
                best_score = score
                best = {
                    "name":    name,
                    "score":   score,
                    "kcal":    round(float(kcal)),
                    "protein": round(float(n.get("proteins_100g") or 0), 1),
                    "fat":     round(float(n.get("fat_100g")      or 0), 1),
                    "carbs":   round(float(n.get("carbohydrates_100g") or 0), 1),
                }

    for query in queries:
        try_query(query)
        if best_score >= 0.6:
            break
        if query != queries[-1]:
            time.sleep(0.1)

    # Fallback: wyszukaj globalnie (bez filtra pl/cc) pierwsze słowo kluczowe
    if best_score < 0.4:
        key_words = [w for w in content_words(product_name) if len(w) >= 4]
        for kw in key_words[:2]:
            try_query(kw, global_search=True)
            if best_score >= 0.4:
                break
            time.sleep(0.1)

    if best and best_score >= MIN_MATCH_SCORE:
        return best
    return None



# ── Baza danych ───────────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def get_products_without_macros(conn, user_id: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, name, unit FROM products
               WHERE user_id = %s AND kcal IS NULL
               ORDER BY name""",
            (user_id,)
        )
        return [{"id": r[0], "name": r[1], "unit": r[2]} for r in cur.fetchall()]


def update_macros(conn, product_id: int, kcal: float, protein: float,
                  fat: float, carbs: float) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE products SET kcal=%s, protein=%s, fat=%s, carbs=%s WHERE id=%s",
            (kcal, protein, fat, carbs, product_id)
        )
    conn.commit()


def show_stats(conn, user_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM products WHERE user_id=%s", (user_id,))
        total = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM products WHERE user_id=%s AND kcal IS NOT NULL", (user_id,))
        filled = cur.fetchone()[0]
    print(f"Produktów razem:       {total}")
    print(f"Z wypełnionym makro:   {filled}  ({100*filled//total if total else 0}%)")
    print(f"Bez makro (do uzupeł): {total - filled}")


# ── Main ──────────────────────────────────────────────────────────────────────

def process_user(conn, user_id: int, dry_run: bool) -> tuple[int, int, int]:
    """Zwraca (uzupełnione, nieznalezione, błędy)."""
    products = get_products_without_macros(conn, user_id)
    print(f"\nUser {user_id}: {len(products)} produktów bez makro")

    filled = not_found = errors = 0

    for i, p in enumerate(products, 1):
        pid   = p["id"]
        name  = p["name"]
        unit  = p["unit"]

        # Produkty szt — pomijamy
        if unit == "szt":
            not_found += 1
            continue

        # Gotowe dania i jogurty smakowe — makro zbyt zmienne, pomijamy
        name_lower = name.lower()
        skip_patterns = [
            # jogurty smakowe
            "jogurt o smaku", "jogurt smak", "jogobella", "jogurt malina",
            "jogurt truskawka", "jogurt wiśni", "jogurt brzoskwini",
            "jogurt banan", "jogurt ananasem", "jogurt mango",
            "napój jogurtowy", "pitny jogurt",
            # gotowe zupy i dania
            "zupa krupnik", "zupa gulasz", "zupa meksykańska",
            "zupa królewska", "zupa prezydencka", "zupa wiosenna",
            "zupa fasolk", "zupa węgierska", "zupa botwinka",
            "zupa cebulowa", "zupa dyniowa", "zupa kalafiorowa",
            "zupa krem z białych", "danie gotowe",
            "makaron błyskawiczny", "zupa błyskawiczna", "zupa instant",
            # wafle i batony
            "wafle ryżowe", "wafel ryżowy", "wafle kukurydziane",
            "wafle zbożowe", "wafelek", "wafelki",
            "baton", "batonik",
            # inne gotowe/junk
            "zakręcony mix", "bake rolls",
        ]
        if any(pat in name_lower for pat in skip_patterns):
            print(f"  [{i}/{len(products)}] {name[:45]:45s} → pomijam (gotowe danie / smakowy)")
            not_found += 1
            continue

        result = search_off(name)

        if result:
            score_str = f"score={result['score']:.2f}"
            macros    = f"kcal={result['kcal']} P={result['protein']} F={result['fat']} C={result['carbs']}"
            match_str = f"→ {result['name'][:30]:30s} {score_str:12s} {macros}"
            print(f"  [{i}/{len(products)}] {name[:40]:40s} {match_str}")

            if not dry_run:
                try:
                    update_macros(conn, pid, result["kcal"], result["protein"],
                                  result["fat"], result["carbs"])
                    filled += 1
                except Exception as e:
                    print(f"    Błąd zapisu: {e}")
                    errors += 1
            else:
                filled += 1
        else:
            print(f"  [{i}/{len(products)}] {name[:45]:45s} → brak dopasowania")
            not_found += 1

        # Uprzejme opóźnienie żeby nie przeciążać OFF API
        time.sleep(0.3 + random.uniform(0, 0.2))

    return filled, not_found, errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Uzupełnij makro produktów z OpenFoodFacts")
    parser.add_argument("--dry-run",    action="store_true")
    parser.add_argument("--all-users",  action="store_true")
    parser.add_argument("--user-id",    type=int, default=DEFAULT_USER_ID)
    parser.add_argument("--stats",      action="store_true",
                        help="Pokaż statystyki uzupełnienia makro")
    args = parser.parse_args()

    conn = get_conn()

    if args.stats:
        if args.all_users:
            with conn.cursor() as cur:
                cur.execute("SELECT id, email FROM users ORDER BY id")
                users = cur.fetchall()
            for uid, email in users:
                print(f"\n── {email} (id={uid}) ──")
                show_stats(conn, uid)
        else:
            show_stats(conn, args.user_id)
        conn.close()
        return

    if args.all_users:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users ORDER BY id")
            user_ids = [r[0] for r in cur.fetchall()]
    else:
        user_ids = [args.user_id]

    total_filled = total_not_found = total_errors = 0
    prefix = "[DRY RUN] " if args.dry_run else ""
    print(f"{prefix}Uzupełnianie makro z OpenFoodFacts...")

    for uid in user_ids:
        f, n, e = process_user(conn, uid, args.dry_run)
        total_filled     += f
        total_not_found  += n
        total_errors     += e

    conn.close()
    print(f"\n{'='*60}")
    print(f"{prefix}Uzupełniono: {total_filled}, brak dopasowania: {total_not_found}, błędy: {total_errors}")
    if args.dry_run:
        print("Aby zapisać, uruchom bez --dry-run")


if __name__ == "__main__":
    main()
