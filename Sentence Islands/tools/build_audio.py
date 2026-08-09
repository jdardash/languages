"""Turn a sentence list into shadowing and active-recall audio tracks.

    python build_audio.py Spanish --voice es-MX-JorgeNeural
    python build_audio.py --list-voices es

Reads <langdir>/sentences.csv, synthesizes each sentence with edge-tts (free
Microsoft neural voices, no API key, needs a network connection), caches the
per-sentence mp3s under <langdir>/audio/, and stitches them with ffmpeg into:

  out/shadow.mp3   target, gap, target, gap        -- for shadowing in dead time
  out/recall.mp3   english, long gap, target, gap  -- hands-free active recall

Re-running only re-synthesizes sentences whose text, voice or rate changed.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ISLANDS_DIR = Path(__file__).resolve().parent.parent
SAMPLE_RATE = 24000
BITRATE = "64k"


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


def load_rows(lang_dir: Path, topic: str | None, limit: int | None) -> list[dict]:
    csv_path = lang_dir / "sentences.csv"
    if not csv_path.exists():
        die(f"missing {csv_path}")
    with csv_path.open(encoding="utf-8-sig", newline="") as fh:
        rows = [r for r in csv.DictReader(fh) if (r.get("target") or "").strip()]
    if topic:
        rows = [r for r in rows if (r.get("topic") or "").strip().lower() == topic.lower()]
    if not rows:
        die("no rows with a filled-in target column (translate some sentences first)")
    return rows[:limit] if limit else rows


def cache_key(text: str, voice: str, rate: str) -> str:
    return hashlib.sha1(f"{text}|{voice}|{rate}".encode("utf-8")).hexdigest()


async def synth_all(jobs: list[tuple[Path, str, str]], rate: str) -> None:
    """jobs: (output path, text, voice). Runs a few at a time."""
    try:
        import edge_tts
    except ImportError:
        die("edge-tts is not installed:  python -m pip install edge-tts")

    sem = asyncio.Semaphore(4)
    done = 0
    total = len(jobs)

    async def one(path: Path, text: str, voice: str) -> None:
        nonlocal done
        async with sem:
            tmp = path.with_suffix(".part")
            await edge_tts.Communicate(text, voice, rate=rate).save(str(tmp))
            tmp.replace(path)
            done += 1
            print(f"\r  synthesizing {done}/{total}", end="", flush=True)

    await asyncio.gather(*(one(*job) for job in jobs))
    print()


def make_silence(audio_dir: Path, seconds: float) -> Path:
    path = audio_dir / f"_silence-{seconds:g}.mp3"
    if not path.exists():
        run_ffmpeg([
            "-f", "lavfi", "-i", f"anullsrc=r={SAMPLE_RATE}:cl=mono",
            "-t", str(seconds), "-c:a", "libmp3lame", "-b:a", BITRATE, str(path),
        ])
    return path


def run_ffmpeg(args: list[str], cwd: Path | None = None) -> None:
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args],
        cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if proc.returncode != 0:
        die(f"ffmpeg failed:\n{proc.stderr.strip()}")


def concat(pieces: list[Path], out_path: Path, audio_dir: Path) -> None:
    list_file = audio_dir / f"_concat-{out_path.stem}.txt"
    list_file.write_text(
        "".join(f"file '{p.name}'\n" for p in pieces), encoding="utf-8"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    run_ffmpeg(
        ["-f", "concat", "-safe", "0", "-i", list_file.name,
         "-c:a", "libmp3lame", "-b:a", BITRATE, "-ar", str(SAMPLE_RATE), "-ac", "1",
         str(out_path.resolve())],
        cwd=audio_dir,
    )
    list_file.unlink(missing_ok=True)


def list_voices(prefix: str) -> None:
    try:
        import edge_tts
    except ImportError:
        die("edge-tts is not installed:  python -m pip install edge-tts")
    voices = asyncio.run(edge_tts.list_voices())
    for v in sorted(voices, key=lambda v: v["ShortName"]):
        if v["ShortName"].lower().startswith(prefix.lower()):
            print(f"{v['ShortName']:<32} {v['Gender']:<8} {v.get('Locale','')}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lang", nargs="?", help="language folder, e.g. Spanish")
    ap.add_argument("--voice", help="target-language voice, or a comma-separated list "
                    "rotated across sentences (talker variability aids perception), "
                    "e.g. es-MX-JorgeNeural,es-MX-DaliaNeural")
    ap.add_argument("--en-voice", default="en-US-AriaNeural", help="voice for the English prompts")
    ap.add_argument("--mode", choices=["shadow", "recall", "both"], default="both")
    ap.add_argument("--rate", default="+0%", help="speech rate for the target language, e.g. -10%%")
    ap.add_argument("--gap", type=float, default=3.0, help="answer pause in the recall track (seconds)")
    ap.add_argument("--topic", help="only sentences with this topic")
    ap.add_argument("--limit", type=int, help="only the first N sentences")
    ap.add_argument("--list-voices", nargs="?", const="", metavar="PREFIX",
                    help="print available voices and exit")
    args = ap.parse_args()

    if args.list_voices is not None:
        list_voices(args.list_voices)
        return
    if not args.lang:
        ap.error("give a language folder, or use --list-voices")
    if not args.voice:
        ap.error("--voice is required (see --list-voices es)")
    if not shutil.which("ffmpeg"):
        die("ffmpeg is not on PATH")

    lang_dir = resolve_lang_dir(args.lang)
    rows = load_rows(lang_dir, args.topic, args.limit)
    audio_dir = lang_dir / "audio"
    audio_dir.mkdir(exist_ok=True)

    manifest_path = audio_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}

    want_english = args.mode in ("recall", "both")
    jobs: list[tuple[Path, str, str]] = []
    plan: list[tuple[dict, Path, Path | None]] = []

    voices = [v.strip() for v in args.voice.split(",") if v.strip()]
    for idx, row in enumerate(rows):
        voice = voices[idx % len(voices)]
        rid = (row.get("id") or "").strip()
        target_path = audio_dir / f"t-{rid}.mp3"
        key = cache_key(row["target"].strip(), voice, args.rate)
        if manifest.get(f"t-{rid}") != key or not target_path.exists():
            jobs.append((target_path, row["target"].strip(), voice))
            manifest[f"t-{rid}"] = key

        en_path = None
        if want_english and (row.get("english") or "").strip():
            en_path = audio_dir / f"e-{rid}.mp3"
            en_key = cache_key(row["english"].strip(), args.en_voice, "+0%")
            if manifest.get(f"e-{rid}") != en_key or not en_path.exists():
                jobs.append((en_path, row["english"].strip(), args.en_voice))
                manifest[f"e-{rid}"] = en_key

        plan.append((row, target_path, en_path))

    print(f"{len(rows)} sentences, {len(jobs)} to synthesize ({len(rows) * (2 if want_english else 1) - len(jobs)} cached)")
    if jobs:
        asyncio.run(synth_all(jobs, args.rate))
        manifest_path.write_text(json.dumps(manifest, indent=1), encoding="utf-8")

    short_gap = make_silence(audio_dir, 0.8)
    tail_gap = make_silence(audio_dir, 1.2)
    answer_gap = make_silence(audio_dir, args.gap)
    out_dir = lang_dir / "out"

    if args.mode in ("shadow", "both"):
        pieces: list[Path] = []
        for _, target_path, _ in plan:
            pieces += [target_path, short_gap, target_path, tail_gap]
        concat(pieces, out_dir / "shadow.mp3", audio_dir)
        print(f"wrote {out_dir / 'shadow.mp3'}")

    if want_english:
        pieces = []
        for _, target_path, en_path in plan:
            if en_path is None:
                continue
            pieces += [en_path, answer_gap, target_path, tail_gap]
        if pieces:
            concat(pieces, out_dir / "recall.mp3", audio_dir)
            print(f"wrote {out_dir / 'recall.mp3'}")


if __name__ == "__main__":
    main()
