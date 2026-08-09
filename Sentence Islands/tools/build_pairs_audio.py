"""Synthesize minimal-pair audio in several voices for the pairs trainer.

    python build_pairs_audio.py spanish

Reads docs/data/pairs-<lang>.json, synthesizes every distinct word in every
listed voice with edge-tts, and writes docs/audio/pairs/<lang>/<word>-v<i>.mp3
where <i> is the voice's index in the JSON "voices" array. High Variability
Phonetic Training needs many talkers - the voice count is the point, not a
nicety. Re-running only synthesizes words whose text or voice changed.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


async def synth_all(jobs: list[tuple[Path, str, str]]) -> None:
    try:
        import edge_tts
    except ImportError:
        die("edge-tts is not installed:  python -m pip install edge-tts")

    sem = asyncio.Semaphore(4)
    done = 0

    async def one(path: Path, text: str, voice: str) -> None:
        nonlocal done
        async with sem:
            tmp = path.with_suffix(".part")
            await edge_tts.Communicate(text, voice).save(str(tmp))
            tmp.replace(path)
            done += 1
            print(f"\r  synthesizing {done}/{len(jobs)}", end="", flush=True)

    await asyncio.gather(*(one(*job) for job in jobs))
    print()


def main() -> None:
    lang = sys.argv[1] if len(sys.argv) > 1 else "spanish"
    data_path = DOCS / "data" / f"pairs-{lang}.json"
    if not data_path.exists():
        die(f"missing {data_path}")
    data = json.loads(data_path.read_text(encoding="utf-8"))

    out_dir = DOCS / "audio" / "pairs" / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}

    words = sorted({w for c in data["contrasts"] for p in c["pairs"] for w in (p["a"], p["b"])})
    jobs: list[tuple[Path, str, str]] = []
    for word in words:
        for vi, voice in enumerate(data["voices"]):
            path = out_dir / f"{word}-v{vi}.mp3"
            cache = hashlib.sha1(f"{word}|{voice}".encode("utf-8")).hexdigest()
            if manifest.get(path.name) != cache or not path.exists():
                jobs.append((path, word, voice))
                manifest[path.name] = cache

    print(f"{len(words)} words x {len(data['voices'])} voices, {len(jobs)} to synthesize")
    if jobs:
        asyncio.run(synth_all(jobs))
        manifest_path.write_text(json.dumps(manifest, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
