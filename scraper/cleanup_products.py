"""
Usuwa z bazy produkty które nie są składnikami kulinarnymi:
słodycze, gotowe dania, smakowe jogurty, napoje, junk food itp.

Użycie:
    # Podgląd co zostanie usunięte (bez usuwania):
    python cleanup_products.py --dry-run

    # Usuń dla konkretnego użytkownika:
    python cleanup_products.py --user-id 2

    # Usuń dla wszystkich:
    python cleanup_products.py --all-users
"""

import argparse
import psycopg2

DB_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "mealplanner",
    "user":     "user",
    "password": "password",
}

DEFAULT_USER_ID = 2

# Wzorce ILIKE — produkty do usunięcia
# Każdy tuple: (opis kategorii, [wzorce SQL ILIKE])
JUNK_PATTERNS = [
    ("Słodycze i batony", [
        "%czekolad%", "%batonik%", "% baton %", "%baton proteinow%",
        "%baton musli%", "%baton zbożow%", "%baton owocow%",
        "%cukierek%", "%żelek%", "%żelki%", "%guma do żucia%", "%gumka do żucia%",
        "%ptasie mleczko%", "%karmelki%", "%karmel %", "%pralina%", "%trufle%",
        "%chałwa%", "%nugat%", "%toffi%", "%marcepan%", "%chrupki%",
        "%twix%", "%mars %", "% snickers%", "%bounty%", "%kitkat%",
        "%oreo%", "%prince polo%", "%milka %", "%kinder %", "%ferrero%",
        "%haribo%", "%skittles%", "%mentos%", "%tic tac%", "%airwaves%",
        "%halls %", "%fruittella%", "%żelkowe%", "%landrynki%",
    ]),
    ("Wafle, chipsy, przekąski", [
        "%wafle ryżowe%", "%wafle kukurydz%", "%wafle zbożowe%", "%wafle z %",
        "%wafelek%", "%wafelki%", "%ryżowe wafle%",
        "%chipsy%", "%chrupki%", "%popcorn%", "%nachos%",
        "%precle%", "%paluszki%", "%bake rolls%", "%airfryer frites%",
        "%tortilla chips%", "%pringles%", "%lay's%", "%lays %",
        "%zakręcony mix%",
    ]),
    ("Napoje i soki", [
        "%napój gazow%", "%napój owocow%", "%napój jogurtowy%", "%napój energety%",
        "%sok jabłk%", "%sok pomarańcz%", "%sok wieloowoc%", "%sok winogron%",
        "%sok pomidor%", "%sok porzeczk%", "%sok marchwiow%",
        "%nektar %", "%lemoniada%", "%ice tea%", "%mrożona herbata%",
        "%cola%", "%pepsi%", "%fanta%", "%sprite%", "%7up%",
        "%red bull%", "%monster %", "%tiger %", "%black energy%",
        "%burn %", "% energy drink%",
        "%actimel%", "%activia%", "%danio %", "%danonki%",
        "%ale pitny%", "%activia %",
        "%starbucks%", "%frappuccino%", "%latte %", "%macchiato%",
        "%cappuccino%", "%cold brew%", "%frappe%",
    ]),
    ("Herbaty i kawy gotowe/smakowe", [
        "%herbata czarna%", "%herbata zielona%", "%herbata owocowa%",
        "%herbata biała%", "%herbata jaśminow%", "%herbata earl grey%",
        "%herbata english%", "%herbata rumiankow%", "%herbata miętow%",
        "%herbata lipow%", "%herbata malinow%", "%herbata z %",
        "%adalbert%", "%lipton%", "%tetley%", "%dilmah%",
        "%kawa zbożowa%", "%kawa instant%", "%kawa rozpuszczaln%",
        "%kawa ziarnista%", "%kawa mielona%", "%espresso %",
        "%nescafe%", "%jacobs%", "%lavazza%", "%illy %",
        "%cappuccino w proszku%", "%cafe%",
    ]),
    ("Jogurty smakowe i pitne", [
        "%jogurt o smaku%", "%jogurt smak%", "%jogurt malina%",
        "%jogurt truskawk%", "%jogurt wiśni%", "%jogurt brzoskwini%",
        "%jogurt banan%", "%jogurt ananasem%", "%jogurt mango%",
        "%jogurt jagod%", "%jogurt porzeczk%", "%jogurt wanili%",
        "%jogurt cytryn%", "%jogurt granat%", "%jogurt kokos%",
        "%jogobella%", "%pitny jogurt%", "%napój jogurtow%",
        "%ale pitny jogurt%", "%7 zbóż men jogurt%",
        "%jogurt z %ananasem%", "%jogurt z %malina%",
        "%jogurt z %truskawk%",
    ]),
    ("Gotowe zupy i dania", [
        "%zupa krupnik%", "%zupa gulasz%", "%zupa meksykańska%",
        "%zupa królewska%", "%zupa prezydencka%", "%zupa wiosenna%",
        "%zupa botwink%", "%zupa cebulowa%", "%zupa dyniowa%",
        "%zupa kalafiorowa%", "%zupa pieczarkowa hortex%",
        "%zupa fasolowa hortex%", "%zupa jarzynowa hortex%",
        "%zupa z fasolk%", "%zupa z grzybową%", "%zupa węgierska%",
        "%zupa ogórkowa%", "%zupa z białych warzyw%",
        "%zupa wysokobiałkow%",
        "%danie gotowe%", "%makaron błyskawiczny%",
        "%zupa błyskawiczna%", "%zupa instant%",
    ]),
    ("Desery i lody", [
        "%lody %", "% lody%", "%sorbet %", "%deser mleczny%",
        "%budyń smak%", "%kisiel smak%", "%galaretka smak%",
        "%sernik w %", "%ciasto w %", "%krem czekoladow%",
        "%nutella%", "%krem kakaow%",
    ]),
    ("Gumy do żucia i miętówki", [
        "%guma do żucia%", "%gumka%", "%mentol%", "%miętówki%",
        "%tic-tac%",
    ]),
]


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def find_junk_products(conn, user_id: int) -> list[dict]:
    """Zwraca listę produktów pasujących do wzorców do usunięcia."""
    all_products = []
    seen_ids = set()

    with conn.cursor() as cur:
        for category, patterns in JUNK_PATTERNS:
            for pat in patterns:
                cur.execute(
                    "SELECT id, name FROM products WHERE user_id = %s AND name ILIKE %s",
                    (user_id, pat)
                )
                for pid, name in cur.fetchall():
                    if pid not in seen_ids:
                        seen_ids.add(pid)
                        all_products.append({"id": pid, "name": name, "category": category})

    return sorted(all_products, key=lambda x: x["name"])


def delete_products(conn, product_ids: list[int]) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM products WHERE id = ANY(%s)",
            (product_ids,)
        )
        deleted = cur.rowcount
    conn.commit()
    return deleted


def main():
    parser = argparse.ArgumentParser(description="Usuń junk food z bazy produktów")
    parser.add_argument("--dry-run",    action="store_true")
    parser.add_argument("--user-id",    type=int, default=DEFAULT_USER_ID)
    parser.add_argument("--all-users",  action="store_true")
    parser.add_argument("--list-users", action="store_true")
    args = parser.parse_args()

    conn = get_conn()

    if args.list_users:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email FROM users ORDER BY id")
            for uid, email in cur.fetchall():
                print(f"  id={uid}  {email}")
        conn.close()
        return

    user_ids = []
    if args.all_users:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users ORDER BY id")
            user_ids = [r[0] for r in cur.fetchall()]
    else:
        user_ids = [args.user_id]

    for uid in user_ids:
        print(f"\nUser {uid}:")
        products = find_junk_products(conn, uid)

        if not products:
            print("  Brak produktów do usunięcia.")
            continue

        # Grupuj po kategorii
        by_cat: dict[str, list] = {}
        for p in products:
            by_cat.setdefault(p["category"], []).append(p["name"])

        for cat, names in by_cat.items():
            print(f"\n  [{cat}] — {len(names)} produktów:")
            for n in names[:10]:
                print(f"    - {n}")
            if len(names) > 10:
                print(f"    ... i {len(names)-10} więcej")

        print(f"\n  Łącznie do usunięcia: {len(products)}")

        if args.dry_run:
            print("  [DRY RUN] Nie usunięto niczego.")
        else:
            ids = [p["id"] for p in products]
            deleted = delete_products(conn, ids)
            print(f"  Usunięto {deleted} produktów.")

    conn.close()


if __name__ == "__main__":
    main()
