"""Active-recall drill over a sentence list. Standard library only.

    python recall_drill.py Spanish -n 25
    python recall_drill.py Spanish --stats
    python recall_drill.py Spanish --export-anki Spanish\\anki.tsv

Shows the English, waits while you say the target sentence OUT LOUD, then reveals
the answer and asks whether you had it. Scheduling is written back into
sentences.csv (columns box / due / misses), so the list is its own scheduler.

Say it out loud. Thinking it does not count -- the mouth is half the skill.
"""

from __future__ import annotations

import argparse
import csv
import random
import sys
from datetime import date, timedelta
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ISLANDS_DIR = Path(__file__).resolve().parent.parent
INTERVALS = {1: 1, 2: 2, 3: 4, 4: 7, 5: 14}  # days, by box after a hit
MAX_BOX = 5


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def resolve_lang_dir(name: str) -> Path:
    candidates = [ISLANDS_DIR / name, Path(name)]
    for candidate in candidates:  # a folder that actually holds a list wins
        if (candidate / "sentences.csv").exists():
            return candidate.resolve()
    for candidate in candidates:
        if candidate.is_dir():
            return candidate.resolve()
    die(f"no such language folder: {name} (looked in {ISLANDS_DIR})")


def load(csv_path: Path) -> tuple[list[dict], list[str]]:
    if not csv_path.exists():
        die(f"missing {csv_path}")
    with csv_path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        fields = list(reader.fieldnames or [])
    for needed in ("box", "due", "misses"):
        if needed not in fields:
            fields.append(needed)
    return rows, fields


def save(csv_path: Path, rows: list[dict], fields: list[str]) -> None:
    tmp = csv_path.with_suffix(".csv.tmp")
    with tmp.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fields})
    tmp.replace(csv_path)


def as_int(value: str | None, default: int = 0) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def is_due(row: dict, today: date) -> bool:
    if not (row.get("target") or "").strip():
        return False
    due = (row.get("due") or "").strip()
    if not due:
        return True
    try:
        return date.fromisoformat(due) <= today
    except ValueError:
        return True


def stats(rows: list[dict], today: date) -> None:
    live = [r for r in rows if (r.get("target") or "").strip()]
    untranslated = len(rows) - len(live)
    by_box: dict[int, int] = {}
    for row in live:
        by_box[as_int(row.get("box"))] = by_box.get(as_int(row.get("box")), 0) + 1
    print(f"{len(live)} translated sentences ({untranslated} still untranslated)")
    print(f"{sum(1 for r in live if is_due(r, today))} due today")
    for box in range(0, MAX_BOX + 1):
        if by_box.get(box):
            label = "new / missed" if box == 0 else f"box {box} (+{INTERVALS.get(box, 14)}d)"
            print(f"  {label:<20} {by_box[box]}")
    hardest = sorted(live, key=lambda r: -as_int(r.get("misses")))[:5]
    if hardest and as_int(hardest[0].get("misses")):
        print("\nmost missed:")
        for row in hardest:
            if as_int(row.get("misses")):
                print(f"  {as_int(row.get('misses')):>3}x  {row.get('english','')}")


def export_anki(rows: list[dict], out_path: Path) -> None:
    live = [r for r in rows if (r.get("target") or "").strip()]
    with out_path.open("w", encoding="utf-8", newline="") as fh:
        for row in live:
            english = (row.get("english") or "").replace("\t", " ")
            target = row["target"].replace("\t", " ")
            topic = (row.get("topic") or "").replace("\t", " ").replace(" ", "-")
            fh.write(f"{english}\t{target}\t{topic}\n")
    print(f"wrote {len(live)} notes to {out_path} (import as tab-separated: Front, Back, Tags)")


def drill(rows: list[dict], due: list[dict], reverse: bool, today: date) -> tuple[int, int, bool]:
    hits = misses = 0
    quit_early = False
    for index, row in enumerate(due, 1):
        prompt_field, answer_field = ("target", "english") if reverse else ("english", "target")
        topic = (row.get("topic") or "").strip()
        print(f"\n[{index}/{len(due)}]{'  ' + topic if topic else ''}")
        print(f"  {row.get(prompt_field, '')}")
        if input("  (say it out loud, then Enter -- q quits) ").strip().lower() == "q":
            quit_early = True
            break
        print(f"  -> {row.get(answer_field, '')}")
        verdict = input("  Enter = had it,  m = missed,  q = quit  ").strip().lower()
        if verdict == "q":
            quit_early = True
            break

        box = as_int(row.get("box"))
        if verdict == "m":
            misses += 1
            row["box"] = "0"
            row["due"] = today.isoformat()
            row["misses"] = str(as_int(row.get("misses")) + 1)
        else:
            hits += 1
            box = min(box + 1, MAX_BOX)
            row["box"] = str(box)
            row["due"] = (today + timedelta(days=INTERVALS[box])).isoformat()
    return hits, misses, quit_early


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lang", help="language folder, e.g. Spanish")
    ap.add_argument("-n", type=int, default=20, help="how many sentences this session")
    ap.add_argument("--topic", help="only sentences with this topic")
    ap.add_argument("--reverse", action="store_true", help="target -> English (easier; new sentences only)")
    ap.add_argument("--all", action="store_true", help="ignore scheduling, draw from everything")
    ap.add_argument("--stats", action="store_true", help="print status and exit")
    ap.add_argument("--export-anki", metavar="PATH", help="write a tab-separated Anki import file and exit")
    args = ap.parse_args()

    lang_dir = resolve_lang_dir(args.lang)
    csv_path = lang_dir / "sentences.csv"
    rows, fields = load(csv_path)
    today = date.today()

    if args.stats:
        stats(rows, today)
        return
    if args.export_anki:
        export_anki(rows, Path(args.export_anki))
        return

    pool = rows
    if args.topic:
        pool = [r for r in pool if (r.get("topic") or "").strip().lower() == args.topic.lower()]
    pool = [r for r in pool if (r.get("target") or "").strip()]
    due = pool if args.all else [r for r in pool if is_due(r, today)]
    if not due:
        print("nothing due today. --all to drill anyway, or add sentences.")
        return

    # Weakest first, then random within that, so misses come back hard.
    random.shuffle(due)
    due.sort(key=lambda r: (as_int(r.get("box")), -as_int(r.get("misses"))))
    due = due[: args.n]

    print(f"{len(due)} sentences. Out loud, from memory, before you look.")
    try:
        hits, misses, quit_early = drill(rows, due, args.reverse, today)
    except (KeyboardInterrupt, EOFError):
        print()
        hits = misses = 0
        quit_early = True

    save(csv_path, rows, fields)
    answered = hits + misses
    if answered:
        print(f"\n{hits}/{answered} recalled ({hits * 100 // answered}%). Saved.")
    if quit_early:
        print("stopped early; progress up to that point was saved.")


if __name__ == "__main__":
    main()
