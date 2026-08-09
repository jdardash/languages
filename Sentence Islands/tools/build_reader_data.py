"""Build the reader's bundled text and tap-lookup dictionary.

Outputs:
  docs/data/reader-spanish.json  passages from A First Spanish Reader
                                 (Remy, Project Gutenberg #15353, public domain)
  docs/data/dict-spanish.json    word -> short gloss. WikDict es-en (CC BY-SA,
                                 the derived file inherits that license) plus
                                 every conjugated form from the Jehle verb
                                 database mapped to its infinitive's gloss -
                                 cheap verb lemmatization that covers most of
                                 the inflected forms a reader actually meets.
"""
import csv
import json
import re
import sqlite3
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
VENDOR = HERE / "vendor-data"
DATA = HERE / ".." / ".." / "docs" / "data"

WORD_RE = re.compile(r"^[a-záéíóúüñ]+$")
FREQ_CUTOFF = 25000
MIN_PASSAGE_CHARS = 400
MAX_PASSAGES = 40


def build_passages():
    raw = (VENDOR / "gutenberg_15353.txt").read_text(encoding="utf-8", errors="replace")
    body = raw.split("*** START", 1)[-1].split("*** END", 1)[0]
    # The reading texts sit between the licence header and the vocabulary
    # appendix; EXERCISES marks the end of the graded readings.
    cut = body.find("EXERCISES")
    if cut > 0:
        body = body[:cut]
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\r?\n\r?\n+", body)]
    # Keep Spanish prose paragraphs: long enough, mostly letters, and dense in
    # Spanish function words (rules out the English preface and notes).
    STOP = {"el", "la", "de", "que", "y", "en", "los", "las", "se", "no", "es",
            "un", "una", "por", "con", "para", "su", "del", "al", "muy"}
    def spanishish(p):
        letters = sum(ch.isalpha() for ch in p)
        if len(p) < 120 or letters / max(1, len(p)) < 0.75 or p.isupper():
            return False
        words = re.findall(r"[a-záéíóúüñ]+", p.lower())
        hits = sum(1 for w in words if w in STOP)
        return len(words) > 20 and hits / len(words) > 0.18
    paras = [p for p in paras if spanishish(p)]

    passages = []
    buf = ""
    for p in paras:
        buf = f"{buf} {p}".strip()
        if len(buf) >= MIN_PASSAGE_CHARS:
            passages.append(buf)
            buf = ""
        if len(passages) >= MAX_PASSAGES:
            break
    out = {
        "language": "spanish",
        "source": "A First Spanish Reader - Alfred Remy (Project Gutenberg #15353, public domain)",
        "passages": [
            {"id": f"p-{i + 1}", "title": f"Passage {i + 1}", "text": t}
            for i, t in enumerate(passages)
        ],
    }
    path = DATA / "reader-spanish.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    print(f"wrote {path.name}: {len(passages)} passages")


def build_dict():
    freq = {}
    for i, line in enumerate((VENDOR / "es_50k.txt").read_text(encoding="utf-8").splitlines()):
        w = line.split(" ")[0]
        freq.setdefault(w, i)

    entries = {}

    # WikDict lemmas, frequency-gated.
    db = sqlite3.connect(VENDOR / "wikdict_es_en.sqlite3")
    for rep, trans in db.execute(
        "SELECT written_rep, trans_list FROM simple_translation ORDER BY rel_importance DESC"
    ):
        w = unicodedata.normalize("NFC", str(rep).strip('"').lower())
        if not WORD_RE.match(w) or w in entries or freq.get(w, 10 ** 6) >= FREQ_CUTOFF:
            continue
        entries[w] = str(trans).split("|")[0].strip()[:60]

    # Jehle conjugated forms -> infinitive gloss (vosotros included: the reader
    # meets peninsular text even though the drills teach es-419).
    forms = 0
    with open(VENDOR / "jehle_verbs.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            inf = row["infinitive"]
            gloss = f"{inf} - {row['infinitive_english'].split(';')[0].strip()}"[:60]
            for col in ("form_1s", "form_2s", "form_3s", "form_1p", "form_2p", "form_3p",
                        "gerund", "pastparticiple"):
                for w in re.split(r"[,;/]", row.get(col) or ""):
                    w = unicodedata.normalize("NFC", w.strip().lower())
                    w = re.sub(r"^(no te |no os |no nos |no se |no )", "", w)
                    if WORD_RE.match(w) and w not in entries:
                        entries[w] = gloss
                        forms += 1

    path = DATA / "dict-spanish.json"
    path.write_text(
        json.dumps({"language": "spanish",
                    "license": "WikDict es-en (CC BY-SA); Jehle verb forms (CC BY-NC-SA)",
                    "words": entries}, ensure_ascii=False),
        encoding="utf-8", newline="\n",
    )
    kb = path.stat().st_size // 1024
    print(f"wrote {path.name}: {len(entries)} entries ({forms} from verb forms), {kb} KB")


if __name__ == "__main__":
    build_passages()
    build_dict()
