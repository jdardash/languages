"""Build cloze-production cards from the frequency deck's own examples.

Each vocab entry whose example sentence contains the headword becomes a cloze:
the word is blanked, the learner produces it from sentence context. This is
the production step the recognition-first deck lacks; using the deck's own
examples keeps register matched and needs no external corpus.

Input:  ../../docs/data/vocab-<lang>.json
Output: ../../docs/data/cloze-<lang>.json
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / ".." / ".." / "docs" / "data"


def main(lang="spanish"):
    deck = json.loads((DATA / f"vocab-{lang}.json").read_text(encoding="utf-8"))
    items = []
    skipped = 0
    for w in deck["words"]:
        example = w.get("example", "")
        word = w["word"]
        # Match the headword as a whole token, case-insensitive, NFC both sides.
        pattern = re.compile(
            rf"(?<![\wÀ-ſ]){re.escape(unicodedata.normalize('NFC', word))}(?![\wÀ-ſ])",
            re.IGNORECASE,
        )
        m = pattern.search(unicodedata.normalize("NFC", example))
        if not m:
            skipped += 1
            continue
        blanked = pattern.sub("____", example, count=1)
        items.append({
            "id": f"z-{w['id']}",
            "rank": w["rank"],
            "text": blanked,
            "answer": m.group(0),
            "en": w.get("exampleEn", ""),
            "gloss": w.get("gloss", ""),
        })
    out = DATA / f"cloze-{lang}.json"
    out.write_text(
        json.dumps({"language": lang, "items": items}, ensure_ascii=False, indent=1),
        encoding="utf-8", newline="\n",
    )
    print(f"wrote {out.name}: {len(items)} cloze cards ({skipped} words without a usable example)")


if __name__ == "__main__":
    main(*sys.argv[1:])
