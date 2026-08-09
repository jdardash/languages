"""Mine additional minimal pairs from ipa-dict for the existing contrasts.

Inputs (vendor-data/, gitignored):
  ipa_es_MX.txt      open-dict-data/ipa-dict es_MX (MIT)
  es_50k.txt         hermitdave/FrequencyWords OpenSubtitles 2018 (CC BY-SA 3.0)
  wikdict_es_en.sqlite3  WikDict es-en (CC BY-SA)

For each contrast already in docs/data/pairs-spanish.json, finds word pairs
whose IPA differs by exactly the contrast's phone substitution (or stress
placement), keeps only pairs where both words are frequent and glossable,
and appends the best new ones. Prints the added pairs for review.
"""
import json
import re
import sqlite3
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
VENDOR = HERE / "vendor-data"
PAIRS = HERE / ".." / ".." / "docs" / "data" / "pairs-spanish.json"

MAX_NEW_PER_CONTRAST = 6
FREQ_CUTOFF = 15000
WORD_RE = re.compile(r"^[a-záéíóúüñ]{3,9}$")


def load_freq():
    ranks = {}
    for i, line in enumerate((VENDOR / "es_50k.txt").read_text(encoding="utf-8").splitlines()):
        w = line.split(" ")[0]
        if w not in ranks:
            ranks[w] = i
    return ranks


def load_ipa():
    ipa = {}
    for line in (VENDOR / "ipa_es_MX.txt").read_text(encoding="utf-8").splitlines():
        if "\t" not in line:
            continue
        word, trans = line.split("\t", 1)
        word = unicodedata.normalize("NFC", word.strip().lower())
        if not WORD_RE.match(word):
            continue
        ipa[word] = trans.strip().strip("/").split(",")[0].strip().strip("/")
    return ipa


def load_glosses():
    db = sqlite3.connect(VENDOR / "wikdict_es_en.sqlite3")
    glosses = {}
    for rep, trans in db.execute("SELECT written_rep, trans_list FROM simple_translation"):
        w = unicodedata.normalize("NFC", rep.strip('"').lower())
        if WORD_RE.match(w) and w not in glosses:
            glosses[w] = trans.split("|")[0].strip()[:40]
    return glosses


def main():
    data = json.loads(PAIRS.read_text(encoding="utf-8"))
    freq = load_freq()
    ipa = load_ipa()
    glosses = load_glosses()

    existing = {frozenset((p["a"], p["b"])) for c in data["contrasts"] for p in c["pairs"]}
    common = {w: t for w, t in ipa.items() if freq.get(w, 99999) < FREQ_CUTOFF}

    # A substitution contrast: (ipa_a, ipa_b). Stress is handled separately.
    SUBS = {"r-rr": ("ɾ", "r"), "d-r": ("d", "ɾ"), "n-nn": ("n", "ɲ")}

    def find_subs(pa, pb):
        found = []
        for w, t in common.items():
            if pa not in t:
                continue
            for m in re.finditer(re.escape(pa), t):
                cand_t = t[:m.start()] + pb + t[m.end():]
                for w2, t2 in common.items():
                    if t2 == cand_t and w2 != w:
                        found.append((w, w2))
        return found

    VOWELS = "aeiouɑɔɛɪʊ"

    def syllables(t):
        return len(re.findall(f"[{VOWELS}]+", t))

    def find_stress():
        # Real stress-position pairs only: both words two-plus syllables, both
        # carrying a primary stress mark at a different phone offset. This
        # excludes diacritical homophone pairs (que vs qué) that sound identical.
        by_segments = {}
        for w, t in common.items():
            if syllables(t) < 2 or "ˈ" not in t:
                continue
            seg = t.replace("ˈ", "").replace("ˌ", "")
            by_segments.setdefault(seg, []).append((w, t))
        found = []
        for group in by_segments.values():
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    (w1, t1), (w2, t2) = group[i], group[j]
                    if t1.index("ˈ") != t2.index("ˈ"):
                        found.append((w1, w2))
        return found

    added_total = 0
    for contrast in data["contrasts"]:
        cid = contrast["id"]
        cands = find_stress() if cid == "stress" else find_subs(*SUBS[cid])
        scored = []
        for a, b in cands:
            if frozenset((a, b)) in existing:
                continue
            if a not in glosses or b not in glosses or glosses[a] == glosses[b]:
                continue
            # Proper-noun glosses (Korea, Montana) are not vocabulary.
            if glosses[a][:1].isupper() or glosses[b][:1].isupper():
                continue
            scored.append((freq.get(a, 99999) + freq.get(b, 99999), a, b))
        scored.sort()
        added = 0
        for _, a, b in scored:
            if added >= MAX_NEW_PER_CONTRAST:
                break
            if frozenset((a, b)) in existing:
                continue
            contrast["pairs"].append({"a": a, "b": b, "glossA": glosses[a], "glossB": glosses[b]})
            existing.add(frozenset((a, b)))
            print(f"{cid}: {a} ({glosses[a]}) vs {b} ({glosses[b]})")
            added += 1
        added_total += added

    PAIRS.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    print(f"added {added_total} pairs -> {PAIRS.name}")


if __name__ == "__main__":
    main()
