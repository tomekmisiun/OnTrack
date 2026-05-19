"""
Konsoliduje bazę produktów: grupuje po typie jedzenia i zostawia 1 wpis na typ.
Usuwa marki, prefiksy BIO/EKO, normalizuje liczby mnogie.
Cena wynikowa = mediana cen z grupy.

Użycie:
    python consolidate_products.py --dry-run        # podgląd (domyślnie)
    python consolidate_products.py --apply          # zastosuj zmiany
    python consolidate_products.py --user-id 2 --apply
    python consolidate_products.py --show-group Makaron
"""

import argparse
import unicodedata
import psycopg2
from collections import Counter, defaultdict
from statistics import median

DB_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "mealplanner",
    "user":     "user",
    "password": "password",
}
DEFAULT_USER_ID = 2

# ─── prefiksy do odcięcia (od najdłuższego) ──────────────────────────────────
STRIP_PREFIXES = sorted([
    "bio ekologiczna", "bio ekologiczny", "bio ekologiczne", "bio ekologicznych",
    "bio organic", "bio",
    "ekologiczna", "ekologiczny", "ekologiczne",
    "bezglutenowy", "bezglutenowa", "bezglutenowe",
    "organiczny", "organiczna", "organiczne",
    "100%",
    "100 %",
], key=len, reverse=True)

# ─── znane marki do odcięcia (pierwsze słowo lub dwa) ────────────────────────
BRAND_WORDS = {
    # nabiał
    "almette", "piątnica", "mlekovita", "łaciate", "mlekpol", "polmlek",
    "ekołukta", "bakoma", "danone", "friko", "zott", "president", "osm",
    "melvit", "rolmlecz", "arla", "apetina", "castelli", "turek",
    "soignon", "kiri",
    # mięso
    "sokołów", "morliny", "indykpol", "drobimex", "animex", "pamapol",
    "berlinki", "rosa", "myfood",
    # przyprawy / sosy
    "kamis", "prymat", "winiary", "knorr", "develey", "felix", "kama",
    # makarony / zboża
    "barilla", "lubella", "sante", "civita", "primo gusto",
    # BIO marki
    "bakalland", "bakallino", "bakello", "bakad'or",
    "taheebo", "naturavena", "ekowital", "ekologiko", "eureko",
    "bio planet", "dary natury", "bartolini", "bioasia", "alce nero",
    "pięć przemian", "alfabet", "dobra kaloria", "lestello",
    # azjatyckie
    "asia flavours", "bali kitchen",
    # inne znane marki
    "mantova", "amberfish", "alpro", "americana", "graal",
    "hortex", "bonduelle", "rolnik", "witamina", "charsznicka",
    "naura", "smak eko", "farmy roztocza", "farma świętokrzyska",
    "fit & easy", "naturally organic", "jansen", "la pont du canard",
    "goat farm", "landana", "principe", "hotos", "nocciolata",
    "molino chiavazza", "brindisa", "dr zdrowie",
    "consorfrut", "mizgier", "kruger", "oleofarm", "biolife", "eko alfabet",
    "ekologiczny stragan", "sątyrz", "hipp", "gerber", "podlaskie",
    "młyn niedźwiady", "diet-food", "sammontana",
    # marki które wyglądają jak przymiotniki / słowa
    "twist",       # Twist Jogurt kawowy Bakoma
    "smoothe",     # Smoothe jogurtowe jabłko...
    "wypasione",   # Wypasione mleko UHT Mlekovita
    "włoszczowa",  # Włoszczowa Ser Gouda (marka serowarni z Włoszczowy)
    # więcej marek
    "bakuś",       # Bakuś serek... Bakoma
    "bonitki",     # Bonitki Ciastka/Herbatniki...
    "kotlin",      # Kotlin konserwa wieprzowa
    "krakus",      # Krakus konserwa/pasztet
    "kujawski",    # Kujawski masło/margaryna
    "łaciaty",     # Łaciaty ser (stara nazwa Łaciate)
    "mutti",       # Mutti pomidory
    "pudliszki",   # Pudliszki ketchup/sos
    "tarczyński",  # Tarczyński kiełbasa
    "trendy",      # Trendy Mleko
    "kraina",      # Kraina Mięs kurczak
    "moja",        # Moja Kraina / Moje Ulubione
    "nasza",       # Nasza Ziemia
    "twój",        # Twój Smak
    "vital",       # Vital suplementy
    "vitanella",   # Vitanella
    "grand",       # Grand Fermentoir
    "elios",       # Elios konserwy
    "hochland",    # Hochland ser
    "galbani",     # Galbani ricotta/mozzarella
    "patak's",     # Patak's curry
    "maretti",     # Maretti chrupki
    "herbapol",    # Herbapol herbata
    "lindt",       # Lindt czekolada
    "nestlé",      # Nestlé
    "teekanne",    # Teekanne herbata
    "président",   # Président masło
    "profi",       # Profi margaryna
    "rapsodia",    # Rapsodia olej
    "łowicz",      # Łowicz dżem/sos
    "roleski",     # Roleski majonez
    "sierpc",      # Sierpc ser
    "podlaski",    # Podlaski ser
    "światowid",   # Światowid
    "gobio",       # Gobio ryba
    "culineo",     # Culineo
    "carmelove",   # Carmelove
    "donatello",   # Donatello
    "diamant",     # Diamant
    "marinero",    # Marinero
    "monte",       # Monte deser Zott
    "primo",       # Primo Gusto (też w "primo gusto" 2-słowowym)
    "pastani",     # Pastani sos
    "plony",       # Plony
    "go",          # Go Active
    "top",         # Top produkty
    "super",       # Super grain itp.
    "dr.",         # Dr. Oetker itp.
    "el",          # El Gusto itp.
    "kraina mięs", # Kraina Mięs kurczak (2-słowowa marka)
    "ba!",         # BA! Granola... Bakalland
    "naturalne",   # Naturalne... (deskryptor marki)
    "naturalnie",  # Naturalnie smaczne...
    "spiżarnia",   # Spiżarnia Auchan
    "radamer",     # Radamer ser
    "lindor",      # Lindor czekolada
    "toro",        # Toro
    "gryzzale",    # Gryzzale
    "smak",        # Smak [cebuli] itp.
    "milker",      # Milker
    "pano",        # Pano
    "kortos",      # Kortos
    "vegan",       # Vegan [produkt]
    "vege",        # Vege [produkt]
    "natur",       # Natur Gold itp.
    "exclusive",   # Exclusive
    "snack",       # Snack line
    "oetker",      # Dr. Oetker
    "men",         # 7 zbóż Men
    "protein",     # Protein bar/shake
    "delikate",    # Delikate
    "gusto",       # Gusto (bez "primo gusto" który już jest)
    "serecek",     # Serecek (marka serka)
    "cardio",      # Cardio (marka)
    "blue",        # Blue Cheese lub marka
    "body",        # Body active itp.
    "corn",        # Corn (marka)
    "active",      # Active mix
    "classic",     # Classic [coś]
    "ekstra",      # Ekstra [masło itp.]
    "fresh",       # Fresh [coś]
    "nieznormalizowane",
    "pomysł",      # Pomysł na... (marka Auchan)
}

# ─── pierwsze słowa które NIE są nazwą jedzenia (przymiotniki, deskryptory) ──
SKIP_FIRST_WORDS = {
    "tradycyjny", "tradycyjna", "tradycyjne",
    "włoski", "włoska", "włoskie",
    "suchy", "sucha", "suche",
    "azjatycki", "azjatycka", "azjatyckie",
    "puszysty", "puszysta", "puszyste",
    "delikatny", "delikatna", "delikatne",
    "klasyczny", "klasyczna", "klasyczne",
    "śniadaniowy", "śniadaniowa", "śniadaniowe",
    "pełnoziarnisty", "pełnoziarnista", "pełnoziarniste",
    "aktywny", "aktywna", "aktywne",
    "domowy", "domowa", "domowe",
    "mieszany", "mieszana", "mieszane",
    "świeży", "świeża", "świeże",
    "suszony", "suszona", "suszone",
    "mrożony", "mrożona", "mrożone",
    "smażony", "smażona", "smażone",
    "gotowy", "gotowa", "gotowe",
    "pieczony", "pieczona", "pieczone",
    "wegański", "wegańska", "wegańskie",
    "wegetariański", "wegetariańska", "wegetariańskie",
    "fermentowany", "fermentowana", "fermentowane",
    "bezmięsny", "bezmięsna", "bezmięsne",
    "bezpieczny", "bezpieczna", "bezpieczne",
    "europejski", "europejska", "europejskie",
    "premium", "extra", "light", "fit",
    "polski", "polska", "polskie",
    "żywy", "żywa", "żywe",
    "tłusty", "tłusta", "tłuste",
    "chude", "chudy", "chuda",
    "mielony", "mielona", "mielone",
    "marynowany", "marynowana", "marynowane",
    "dojrzały", "dojrzała", "dojrzałe",
    "naturalny", "naturalna", "naturalne",
    "ekologiczny", "ekologiczna", "ekologiczne",
    "bułgarski", "bułgarska", "bułgarskie",
    "bochenek",   # bochenek chleba → chleb
    "długi",      # ogórek długi
    "czerwony", "czerwona", "czerwone",
    "zielony", "zielona", "zielone",
    "żółty", "żółta", "żółte",
    "słodki", "słodka", "słodkie",
    "słony", "słona", "słone",
    "ostry", "ostra", "ostre",
    "łagodny", "łagodna", "łagodne",
    "rafinowany", "rafinowana", "rafinowane",
    "nierafinowany", "nierafinowana", "nierafinowane",
    "oczyszczony", "oczyszczona", "oczyszczone",
    "podwójny", "podwójna", "podwójne",
    "hiszpański", "hiszpańska", "hiszpańskie",
    "chiński", "chińska", "chińskie",
    "włoski", "włoska", "włoskie",  # "Włoskie pierogi" → "Pierogi"
    "grecki", "grecka", "greckie",
    "francuski", "francuska", "francuskie",
    "wędzone", "wędzony", "wędzona",
    "gotowane", "gotowany", "gotowana",
    "blanszowany", "blanszowana", "blanszowane",
    "prażony", "prażona", "prażone",
    "łuskany", "łuskana", "łuskane",
}

# ─── normalizacja liczby mnogiej → pojedyncza ────────────────────────────────
PLURAL_MAP = {
    "brokuły": "brokuł",
    "borówki": "borówka",
    "banany": "banan",
    "cytryny": "cytryna",
    "gruszki": "gruszka",
    "jabłka": "jabłko",
    "truskawki": "truskawka",
    "maliny": "malina",
    "wiśnie": "wiśnia",
    "poziomki": "poziomka",
    "ogórki": "ogórek",
    "pomidory": "pomidor",
    "marchewki": "marchew",
    "marchwi": "marchew",
    "ziemniaki": "ziemniak",
    "bataty": "batat",
    "batatat": "batat",
    "jajka": "jajko",
    "jaja": "jajko",
    "orzechy": "orzech",
    "migdały": "migdał",
    "rodzynki": "rodzynek",
    "szparagi": "szparag",
    "grzyby": "grzyb",
    "pieczarki": "pieczarka",
    "papryki": "papryka",
    "cebule": "cebula",
    "daktyle": "daktyl",
    "figi": "figa",
    "śliwki": "śliwka",
    "morele": "morela",
    "brzoskwinie": "brzoskwinia",
    "mandarynki": "mandarynka",
    "pomarańcze": "pomarańcza",
    "ananasy": "ananas",
    "bułki": "bułka",
    "bagietki": "bagietka",
    "tortille": "tortilla",
    "naleśniki": "naleśnik",
    "krakersy": "krakers",
    "herbatniki": "herbatnik",
    "biszkopty": "biszkopt",
    "ciastka": "ciastko",
    "kiełbasy": "kiełbasa",
    "parówki": "parówka",
    "wędliny": "wędlina",
    "grzanki": "grzanka",
    "dżemy": "dżem",
    "konfitury": "konfitura",
    "marmolady": "marmolada",
    "oliwki": "oliwka",
    "kapary": "kaper",
    "szpinak": "szpinak",
    "ryże": "ryż",
    "kasze": "kasza",
    "makarony": "makaron",
    # buraki/buraczki
    "buraki": "burak",
    "buraczki": "burak",
    "burak": "burak",
    # marchew
    "marchewka": "marchew",
    "marchewki": "marchew",
    # cebula
    "cebulka": "cebula",
    # pierogi/kluski
    "pierogi": "pierogi",
    "kopytka": "kopytko",
    "kluski": "kluski",
    # inne
    "winogrona": "winogrono",
    "nogi": "noga",
    "piersi": "pierś",
    "polędwiczki": "polędwiczka",
    "filety": "filet",
    "podgrzybki": "podgrzybek",
    "pomidorki": "pomidor",
    # kurze skrzydła
    "skrzydełka": "skrzydło",
    "skrzydła": "skrzydło",
    # owoce (dopełniacz "owoców")
    "owoców": "owoc",
    "owoce": "owoc",
    # ciecierzyca
    "cieciorka": "ciecierzyca",
    # stewia = stevia
    "stevia": "stewia",
    # wędliny
    "wędlin": "wędlina",
    # skrzydełka kury
    "skrzydełko": "skrzydło",
}


PREPOSITIONS = {"na", "do", "z", "ze", "w", "we", "i", "lub",
                "bez", "dla", "od", "po", "przy", "przed",
                "100", "200", "500", "1000", "%"}


def _strip_prefix_from_words(words: list) -> list:
    """Odcina znane prefiksy z początku listy słów."""
    joined = " ".join(words).lower()
    for prefix in STRIP_PREFIXES:
        if joined.startswith(prefix + " ") or joined.startswith(prefix + ","):
            rest = " ".join(words)[len(prefix):].strip().lstrip(",").strip()
            return rest.split() if rest else []
    return words


def _word_root(word: str) -> str:
    """Zwraca rdzeń słowa bez elipsis i interpunkcji (np. 'na…kurczaka' → 'na')."""
    import re
    parts = re.split(r'[…\.…]+', word)
    return parts[0]


def get_canonical(name: str) -> str:
    """Wyciąga kanoniczną nazwę (1 słowo) z nazwy produktu."""
    n = name.strip()
    lower = n.lower()

    # 1. Odetnij znane prefiksy (BIO, Ekologiczny itp.)
    for prefix in STRIP_PREFIXES:
        if lower.startswith(prefix + " ") or lower.startswith(prefix + ","):
            n = n[len(prefix):].strip().lstrip(",").strip()
            lower = n.lower()
            break

    # 2. Odetnij marki (2-słowowe potem 1-słowowe)
    words = n.split()
    if len(words) >= 2 and (words[0] + " " + words[1]).lower() in BRAND_WORDS:
        words = words[2:]
    if words and words[0].lower() in BRAND_WORDS:
        words = words[1:]

    # 2b. Odetnij prefiksy ponownie (na wypadek gdy marka była przed "100%")
    words = _strip_prefix_from_words(words)

    # 3. Pomiń pierwsze słowa jeśli to przymiotniki/deskryptory/przyimki (pętla)
    for _ in range(6):
        if not words:
            break
        root = _word_root(words[0].lower())
        if root in SKIP_FIRST_WORDS or root in PREPOSITIONS:
            words = words[1:]
        else:
            break

    if not words:
        return name.split()[0]

    base = _word_root(words[0].lower())

    # 4. Normalizuj liczby mnogie
    base = PLURAL_MAP.get(base, base)

    return base.capitalize()


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def load_products(conn, user_id: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, package_weight, price, unit,
                   kcal, protein, fat, carbs, sold_by_weight
            FROM products
            WHERE user_id = %s
            ORDER BY name
        """, (user_id,))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def group_products(products: list[dict]) -> dict[str, list[dict]]:
    groups = defaultdict(list)
    for p in products:
        key = get_canonical(p["name"])
        groups[key].append(p)
    return dict(groups)


def avg_macro(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    return round(sum(vals) / len(vals), 1)


def most_common_value(values):
    c = Counter(v for v in values if v is not None)
    if not c:
        return None
    return c.most_common(1)[0][0]


def merge_group(name: str, products: list[dict]) -> dict:
    """Tworzy jeden kanoniczny produkt z grupy. Cena = mediana."""
    units   = [p["unit"] for p in products]
    weights = [p["package_weight"] for p in products]
    prices  = [p["price"] for p in products if p["price"] and p["price"] > 0]

    return {
        "name":           name,
        "unit":           most_common_value(units) or "g",
        "package_weight": most_common_value(weights) or 100,
        "price":          round(median(prices), 4) if prices else 0,
        "kcal":           avg_macro([p["kcal"]    for p in products]),
        "protein":        avg_macro([p["protein"] for p in products]),
        "fat":            avg_macro([p["fat"]     for p in products]),
        "carbs":          avg_macro([p["carbs"]   for p in products]),
        "sold_by_weight": bool(sum(1 for p in products if p["sold_by_weight"]) > len(products) / 2),
    }


def get_ingredient_map(conn, product_ids: list[int]) -> dict[int, int]:
    if not product_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT product_id, COUNT(*) FROM recipe_ingredients "
            "WHERE product_id = ANY(%s) GROUP BY product_id",
            (product_ids,)
        )
        return {row[0]: row[1] for row in cur.fetchall()}


def apply_consolidation(conn, user_id: int, groups: dict[str, list[dict]], dry_run: bool):
    all_ids = [p["id"] for grp in groups.values() for p in grp]
    usage   = get_ingredient_map(conn, all_ids)

    total_before   = sum(len(v) for v in groups.values())
    groups_changed = {k: v for k, v in groups.items() if len(v) > 1}
    total_after    = len(groups)

    print(f"\nProdukty przed: {total_before}  →  po: {total_after}  "
          f"(usunięcie {total_before - total_after})")
    print(f"Grup do połączenia: {len(groups_changed)}\n")

    if dry_run:
        print("=== PODGLĄD (--dry-run) ===\n")
        for name, products in sorted(groups_changed.items(), key=lambda x: -len(x[1])):
            print(f"  [{len(products):3d}→1] {name}")
            merged = merge_group(name, products)
            kcal_str = f"{merged['kcal']} kcal" if merged["kcal"] else "brak kcal"
            price_str = f"cena mediana={merged['price']:.2f}"
            print(f"           waga={merged['package_weight']} {merged['unit']}  {kcal_str}  {price_str}")
            for p in products[:5]:
                use = f"  (używany {usage[p['id']]}x)" if p["id"] in usage else ""
                print(f"           - {p['name']}{use}")
            if len(products) > 5:
                print(f"           ... i {len(products)-5} więcej")
        print("\nUruchom z --apply żeby zastosować.")
        return

    # ─── APPLY ───────────────────────────────────────────────────────────────
    with conn.cursor() as cur:
        deleted    = 0
        updated    = 0

        for name, products in groups.items():
            if len(products) == 1:
                p = products[0]
                if p["name"] != name:
                    cur.execute("UPDATE products SET name=%s WHERE id=%s", (name, p["id"]))
                continue

            merged = merge_group(name, products)

            # Wybierz canonical: preferuj produkt z makrami i użyciem w przepisach
            def score(p):
                return (int(p["kcal"] is not None) * 10) + usage.get(p["id"], 0)

            canonical = max(products, key=score)
            rest      = [p for p in products if p["id"] != canonical["id"]]
            rest_ids  = [p["id"] for p in rest]

            cur.execute("""
                UPDATE products SET
                    name=%s, package_weight=%s, price=%s, unit=%s,
                    kcal=%s, protein=%s, fat=%s, carbs=%s, sold_by_weight=%s
                WHERE id=%s
            """, (
                merged["name"], merged["package_weight"], merged["price"],
                merged["unit"], merged["kcal"], merged["protein"],
                merged["fat"],  merged["carbs"], merged["sold_by_weight"],
                canonical["id"]
            ))

            # Przepnij recipe_ingredients na canonical
            cur.execute(
                "UPDATE recipe_ingredients SET product_id=%s WHERE product_id=ANY(%s)",
                (canonical["id"], rest_ids)
            )
            updated += cur.rowcount

            # Usuń duplikaty
            cur.execute("DELETE FROM products WHERE id=ANY(%s)", (rest_ids,))
            deleted += cur.rowcount

    conn.commit()
    print(f"Usunięto {deleted} produktów, zaktualizowano {updated} składników przepisów.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run",    action="store_true", default=True)
    parser.add_argument("--apply",      action="store_true")
    parser.add_argument("--user-id",    type=int, default=DEFAULT_USER_ID)
    parser.add_argument("--show-group", type=str,
                        help="Pokaż wszystkie produkty w danej grupie")
    args = parser.parse_args()

    dry_run = not args.apply

    conn     = get_conn()
    products = load_products(conn, args.user_id)
    groups   = group_products(products)

    if args.show_group:
        key   = args.show_group
        grp   = groups.get(key)
        if not grp:
            matches = {k: v for k, v in groups.items() if k.lower() == key.lower()}
            if matches:
                key, grp = next(iter(matches.items()))
            else:
                print(f"Brak grupy '{key}'. Pierwsze 20 grup:")
                for k in sorted(groups.keys())[:20]:
                    print(f"  {k} ({len(groups[k])})")
                conn.close()
                return
        print(f"\nGrupa: {key}  ({len(grp)} produktów)")
        merged = merge_group(key, grp)
        print(f"Wynikowy: waga={merged['package_weight']} {merged['unit']}, "
              f"kcal={merged['kcal']}, B={merged['protein']}, "
              f"T={merged['fat']}, W={merged['carbs']}, "
              f"cena mediana={merged['price']:.2f}")
        print()
        usage = get_ingredient_map(conn, [p["id"] for p in grp])
        for p in sorted(grp, key=lambda x: x["name"]):
            macro = f"kcal={p['kcal']}" if p["kcal"] else "brak makro"
            use   = f"  (przepis {usage[p['id']]}x)" if p["id"] in usage else ""
            print(f"  [{p['id']:5d}] {p['name']:<60s} {macro}{use}")
        conn.close()
        return

    apply_consolidation(conn, args.user_id, groups, dry_run=dry_run)
    conn.close()


if __name__ == "__main__":
    main()
