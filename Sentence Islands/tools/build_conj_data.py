"""Build the conjugation drill deck from the Fred Jehle Spanish verb database.

Input:  vendor-data/jehle_verbs.csv  (CC BY-NC-SA 3.0, attribution in README)
Output: ../../docs/data/conj-spanish.json

Selection: high-frequency verbs x the four tense/mood cells that carry a
beginner through B1 (present, preterite, imperfect, present subjunctive).
Vosotros forms are dropped - the site teaches es-419.
"""
import csv
import json
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / ".." / ".." / "docs" / "data" / "conj-spanish.json"

VERBS = [
    "ser", "estar", "tener", "hacer", "poder", "decir", "ir", "ver", "dar",
    "saber", "querer", "llegar", "pasar", "deber", "poner", "parecer",
    "quedar", "creer", "hablar", "llevar", "dejar", "seguir", "encontrar",
    "llamar", "venir", "pensar", "salir", "volver", "tomar", "conocer",
    "vivir", "sentir", "mirar", "contar", "empezar", "esperar", "buscar",
    "entrar", "trabajar", "escribir", "perder", "entender", "pedir",
    "recibir", "recordar", "terminar", "aprender", "comer", "beber", "jugar",
    "leer", "abrir", "dormir", "comprar", "necesitar", "usar", "pagar",
    "ayudar", "gustar", "oir",
]

CELLS = [
    ("Indicativo", "Presente", "present"),
    ("Indicativo", "Pretérito", "preterite"),
    ("Indicativo", "Imperfecto", "imperfect"),
    ("Subjuntivo", "Presente", "present subjunctive"),
]

PERSONS = [
    ("1s", "yo"),
    ("2s", "tú"),
    ("3s", "él / ella / usted"),
    ("1p", "nosotros"),
    ("3p", "ellos / ustedes"),
]


def main():
    rows = {}
    with open(HERE / "vendor-data" / "jehle_verbs.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows[(row["infinitive"], row["mood"], row["tense"])] = row

    items = []
    missing = []
    for verb in VERBS:
        for mood, tense, tense_en in CELLS:
            row = rows.get((verb, mood, tense))
            if row is None:
                # oir is stored with the accent
                row = rows.get((verb.replace("oir", "oír"), mood, tense))
            if row is None:
                missing.append((verb, mood, tense))
                continue
            forms = {}
            for suffix, label in PERSONS:
                form = row[f"form_{suffix}"].strip()
                if form:
                    forms[suffix] = form
            if len(forms) < 4:
                continue
            items.append({
                "verb": row["infinitive"],
                "english": row["infinitive_english"].split(";")[0].strip(),
                "mood": mood,
                "tense": tense,
                "tenseEn": tense_en,
                "forms": forms,
            })
    if missing:
        print(f"note: {len(missing)} verb/tense cells not found: {missing[:5]}")

    data = {
        "language": "spanish",
        "attribution": "Conjugations from the Fred Jehle Spanish verb database (CC BY-NC-SA 3.0).",
        "persons": {s: l for s, l in PERSONS},
        "items": items,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    cells = sum(len(i["forms"]) for i in items)
    print(f"wrote {OUT.name}: {len(items)} verb-tense items, {cells} drillable cells")


if __name__ == "__main__":
    main()
