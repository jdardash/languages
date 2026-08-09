"""Emit docs/data/<lang>.json, copy audio, and sync method docs for the site.

Usage: python "Sentence Islands/tools/build_site_data.py" Spanish

sentences.csv stays the single source of truth for content; this script is the
only bridge between the Python tooling and the static site. Re-run it after
editing any sentence list or method document.
"""
import csv
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
LANGS = {
    "Spanish": {
        "id": "spanish", "label": "Spanish", "bcp47": "es-419",
        "book": {"title": "Complete Spanish Step-by-Step - Bregstein",
                 "free": "Language Transfer Complete Spanish (free audio course)"},
        "resources": [
            {"label": "Dreaming Spanish - graded comprehensible input, 7,000+ videos",
             "url": "https://www.dreamingspanish.com/", "kind": "video"},
            {"label": "Language Transfer Complete Spanish - 90 audio tracks, absolute-beginner spine",
             "url": "https://www.languagetransfer.org/complete-spanish", "kind": "listening"},
            {"label": "FSI / Peace Corps Spanish - public domain, with audio",
             "url": "https://www.livelingua.com/courses/spanish", "kind": "listening"},
            {"label": "italki - book tutor sessions (send the standing instruction first)",
             "url": "https://www.italki.com/", "kind": "tutor"},
        ],
    },
    "French": {
        "id": "french", "label": "French", "bcp47": "fr-FR",
        "book": {"title": "Assimil New French with Ease",
                 "free": "FSI French Basic (livelingua.com)"},
        "resources": [
            {"label": "InnerFrench - intermediate podcast with transcripts",
             "url": "https://innerfrench.com/", "kind": "listening"},
            {"label": "FSI French Basic - public domain, with audio",
             "url": "https://www.livelingua.com/courses/french", "kind": "listening"},
            {"label": "italki - book tutor sessions (send the standing instruction first)",
             "url": "https://www.italki.com/", "kind": "tutor"},
        ],
    },
}
METHOD_DOCS = [
    ("README.md", "overview.md", "Overview"),
    ("METHOD.md", "method.md", "The Method (Sentence Islands)"),
    ("How To Learn Languages.md", "how-to-learn-languages.md", "How To Learn Languages (Evidence)"),
    ("Polyglot Practices Research.md", "polyglot-practices.md", "What Top Learners Actually Do"),
    ("Sentence Islands/README.md", "sentence-islands.md", "Sentence Islands Pipeline"),
]


def build(folder_name: str) -> None:
    meta = LANGS[folder_name]
    src = ROOT / "Sentence Islands" / folder_name
    audio_src = src / "audio"
    audio_dst = DOCS / "audio" / meta["id"]
    audio_dst.mkdir(parents=True, exist_ok=True)
    sentences = []
    with open(src / "sentences.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sid = row["id"].strip()
            entry = {"id": f"s-{sid}", "en": row["english"].strip(),
                     "target": row["target"].strip(), "topic": row["topic"].strip()}
            for key, prefix in (("audio", "t"), ("promptAudio", "e")):
                clip = audio_src / f"{prefix}-{sid}.mp3"
                if clip.exists():
                    shutil.copy2(clip, audio_dst / clip.name)
                    entry[key] = f"audio/{meta['id']}/{clip.name}"
            sentences.append(entry)
    data_dir = DOCS / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    out = {"language": meta["id"], "label": meta["label"], "bcp47": meta["bcp47"],
           "book": meta["book"], "resources": meta["resources"],
           "sentences": sentences}
    (data_dir / f"{meta['id']}.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    sync_method_docs()
    write_manifest()
    print(f"{meta['id']}: {len(sentences)} sentences")


def sync_method_docs() -> None:
    dst = DOCS / "method"
    dst.mkdir(parents=True, exist_ok=True)
    for src_name, dst_name, _ in METHOD_DOCS:
        src = ROOT / src_name
        if src.exists():
            shutil.copy2(src, dst / dst_name)


def write_manifest() -> None:
    langs = [{"id": m["id"], "label": m["label"], "data": f"data/{m['id']}.json"}
             for m in LANGS.values()
             if (DOCS / "data" / f"{m['id']}.json").exists()]
    manifest = {"languages": langs,
                "methodDocs": [{"title": t, "file": f"method/{d}"} for _, d, t in METHOD_DOCS]}
    (DOCS / "data" / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Spanish")
