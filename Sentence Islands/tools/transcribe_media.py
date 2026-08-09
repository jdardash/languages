"""Turn any audio file into a Reader library text with faster-whisper.

    python transcribe_media.py podcast.mp3 --lang spanish --title "Radio Ambulante 231"

Transcribes locally (no network after the one-time model download), writes the
transcript into docs/data/library-<lang>.json, and the Reader page lists it
automatically under "Library: <title>". This is the LingQ-5 move: every
podcast you listen to becomes a readable, minable text.

Requires: pip install faster-whisper
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs" / "data"

LANG_CODES = {"spanish": "es", "french": "fr"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("media", help="audio file (mp3/wav/m4a/mp4...)")
    ap.add_argument("--lang", default="spanish", choices=sorted(LANG_CODES))
    ap.add_argument("--title", default=None)
    ap.add_argument("--model", default="small", help="tiny/base/small/medium/large-v3")
    args = ap.parse_args()

    from faster_whisper import WhisperModel

    media = Path(args.media)
    title = args.title or media.stem
    print(f"loading {args.model} model...")
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    print(f"transcribing {media.name} ({args.lang})...")
    segments, info = model.transcribe(str(media), language=LANG_CODES[args.lang], vad_filter=True)
    text = " ".join(seg.text.strip() for seg in segments)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        raise SystemExit("error: no speech found")

    path = DATA / f"library-{args.lang}.json"
    lib = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"language": args.lang, "items": []}
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40]
    lib["items"] = [x for x in lib["items"] if x["id"] != f"lib-{slug}"]
    lib["items"].append({"id": f"lib-{slug}", "title": title, "text": text,
                         "source": media.name, "durationMin": round(info.duration / 60, 1)})
    path.write_text(json.dumps(lib, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    print(f"wrote {path.name}: '{title}' ({len(text.split())} words, {info.duration/60:.1f} min)")
    print("open the Reader page - the text is in the passage picker.")


if __name__ == "__main__":
    main()
