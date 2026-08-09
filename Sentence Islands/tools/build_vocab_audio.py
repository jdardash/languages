"""Synthesize per-word and per-example clips for the frequency core deck.

    python build_vocab_audio.py spanish --voice es-MX-JorgeNeural,es-MX-DaliaNeural

Reads docs/data/vocab-<lang>.json, writes docs/audio/<lang>/vocab/w-<n>.mp3
(word) and w-<n>-ex.mp3 (example sentence), then rewrites the deck JSON with
audio/exampleAudio paths. Caches by text+voice hash in a manifest next to the
clips; re-running only synthesizes what changed. Voices rotate across words
(talker variability aids perception).
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

REPO = Path(__file__).resolve().parents[2]
DOCS = REPO / "docs"


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def cache_key(text: str, voice: str) -> str:
    return hashlib.sha1(f"{text}|{voice}".encode("utf-8")).hexdigest()


async def synth_all(jobs: list[tuple[Path, str, str]]) -> None:
    try:
        import edge_tts
    except ImportError:
        die("edge-tts is not installed:  python -m pip install edge-tts")

    sem = asyncio.Semaphore(3)
    done = 0
    total = len(jobs)
    failed: list[str] = []

    async def one(path: Path, text: str, voice: str) -> None:
        nonlocal done
        async with sem:
            tmp = path.with_suffix(".part")
            for attempt in range(4):
                try:
                    await asyncio.wait_for(
                        edge_tts.Communicate(text, voice).save(str(tmp)), timeout=45)
                    tmp.replace(path)
                    break
                except Exception:
                    if attempt == 3:
                        failed.append(path.name)
                        break
                    await asyncio.sleep(2 ** attempt)
            done += 1
            print(f"\r  synthesizing {done}/{total}", end="", flush=True)

    await asyncio.gather(*(one(*job) for job in jobs))
    print()
    if failed:
        print(f"failed after retries: {len(failed)}: {', '.join(failed[:10])}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lang", help="language id, e.g. spanish")
    ap.add_argument("--voice", required=True, help="comma-separated voice list, rotated across words")
    args = ap.parse_args()

    deck_path = DOCS / "data" / f"vocab-{args.lang}.json"
    if not deck_path.exists():
        die(f"missing {deck_path}")
    deck = json.loads(deck_path.read_text(encoding="utf-8"))

    audio_dir = DOCS / "audio" / args.lang / "vocab"
    audio_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = audio_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}

    voices = [v.strip() for v in args.voice.split(",") if v.strip()]
    jobs: list[tuple[Path, str, str]] = []
    for idx, w in enumerate(deck["words"]):
        voice = voices[idx % len(voices)]
        n = w["id"].removeprefix("w-")
        for suffix, text in (("", w["word"]), ("-ex", w["example"])):
            name = f"w-{n}{suffix}.mp3"
            path = audio_dir / name
            k = cache_key(text, voice)
            if manifest.get(name) != k or not path.exists():
                jobs.append((path, text, voice))
                manifest[name] = k
            w["audio" if not suffix else "exampleAudio"] = f"audio/{args.lang}/vocab/{name}"

    print(f"{len(deck['words'])} words, {len(jobs)} clips to synthesize")
    if jobs:
        asyncio.run(synth_all(jobs))
        manifest_path.write_text(json.dumps(manifest, indent=1), encoding="utf-8")

    deck_path.write_text(json.dumps(deck, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"rewrote {deck_path}")


if __name__ == "__main__":
    main()
