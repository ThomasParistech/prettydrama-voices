"""Process actor voice ZIPs dropped in uploads/voix/.

For each ZIP:
 - read its manifest.json (bare {line id: raw text} mapping) — the text is
   the RAW line text at recording time; normalization happens ONLY here
   in the Action (single implementation), never in the browser. The audio
   member is named {id}.{ext} (extension chosen by the recording browser),
   so it is located from the id alone.
 - VALIDATE the whole manifest first, then transcode every clip with ffmpeg
   in a single pass (leading/trailing silence trim + loudness normalization +
   mp3 mono ~64 kbps) into a temp dir, and only if EVERY clip succeeded,
   publish clips/{id}.mp3 and update data/clips.json ({line id: raw text}).
   A ZIP is merged entirely or not at all — never half.
 - delete the processed ZIP (idempotent merge: re-sending a clip for the same
   line id simply overwrites it)

Faulty ZIPs (corrupted, missing manifest, ffmpeg failure, oversized) are also
removed — otherwise they would fail on every subsequent run — and reported in
uploads_errors.json so the workflow can open a clear GitHub issue in French.
ANY exception in one ZIP is contained: it must not block the other ZIPs nor
lose the updates already merged in this run.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from common import REPO_ROOT, write_json

UPLOADS_DIR = REPO_ROOT / "uploads" / "voix"
CLIPS_DIR = REPO_ROOT / "clips"
CLIPS_JSON = REPO_ROOT / "data" / "clips.json"
ERRORS_PATH = REPO_ROOT / "uploads_errors.json"

# Line ids become clip filenames, so only accept strictly safe characters.
# Mirror of SAFE_ID in src/editor/reducer.js — keep in sync. (Alphanumeric,
# not just hex: hand-edited readable ids must not be rejected at this late
# stage when the editor accepted them.)
LINE_ID_PATTERN = re.compile(r"^[0-9a-zA-Z-]{1,64}$")

# Sanity caps against hostile or absurd uploads (a real take is a few
# hundred kB; a whole play's ZIP a few dozen MB).
MAX_CLIPS_PER_ZIP = 2000
MAX_MANIFEST_BYTES = 2 * 1024 * 1024
MAX_CLIP_BYTES = 50 * 1024 * 1024

# Single-pass ffmpeg filter chain:
#  1. trim leading silence
#  2. reverse, trim (now-leading) trailing silence, reverse back
#  3. loudness normalization (EBU R128)
AUDIO_FILTER = (
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,"
    "areverse,"
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,"
    "areverse,"
    "loudnorm=I=-16:TP=-1.5:LRA=11"
)


class ZipError(Exception):
    """A problem with one uploaded ZIP, described in French for the issue."""


def read_member_capped(archive, name: str, cap: int) -> bytes:
    """Read a ZIP member enforcing a REAL decompressed-size cap (headers can
    lie, so count the actual bytes)."""
    with archive.open(name) as fh:
        data = fh.read(cap + 1)
    if len(data) > cap:
        raise ZipError(f"le fichier « {name} » est anormalement gros (plus de {cap // (1024 * 1024)} Mo)")
    return data


def transcode(source: Path, dest: Path) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-af",
        AUDIO_FILTER,
        "-ar",
        "44100",
        "-ac",
        "1",
        "-b:a",
        "64k",
        str(dest),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise ZipError(
            f"la conversion audio a échoué pour « {source.name} » : {result.stderr.strip()[:500]}"
        )


def parse_manifest(archive) -> list[tuple[str, str, str]]:
    """Validate the {line id: raw text} manifest and return
    (line_id, audio_member_name, raw_text) triples."""
    names = set(archive.namelist())
    if "manifest.json" not in names:
        raise ZipError(
            "le fichier manifest.json est absent du ZIP — le ZIP doit venir de la page "
            "« Enregistrement » du site, sans être modifié"
        )
    try:
        manifest = json.loads(read_member_capped(archive, "manifest.json", MAX_MANIFEST_BYTES).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ZipError("le manifest.json du ZIP est illisible") from exc

    if not isinstance(manifest, dict):
        raise ZipError("le manifest.json du ZIP n'a pas le format attendu")
    if len(manifest) > MAX_CLIPS_PER_ZIP:
        raise ZipError(f"le ZIP contient trop de clips ({len(manifest)})")

    # Validate EVERY entry before touching anything.
    audio_names = names - {"manifest.json"}
    entries = []
    for line_id, text in manifest.items():
        if not LINE_ID_PATTERN.match(line_id) or not isinstance(text, str):
            raise ZipError(f"une entrée du manifest est invalide : {str({line_id: text})[:200]}")
        # The audio member is {id}.{ext} — the extension depends on the
        # recording browser, so locate it by id (ids cannot contain dots,
        # and the fullmatch keeps the member name free of path tricks).
        matches = [n for n in audio_names if re.fullmatch(re.escape(line_id) + r"\.[0-9a-zA-Z]+", n)]
        if len(matches) != 1:
            raise ZipError(
                f"le fichier audio de la réplique « {line_id} » est introuvable (ou en double) dans le ZIP"
            )
        entries.append((line_id, matches[0], text))
    return entries


def process_zip(zip_path: Path, clips_index: dict) -> int:
    """All-or-nothing merge of one ZIP. Returns the number of clips merged."""
    import zipfile

    try:
        archive = zipfile.ZipFile(zip_path)
    except (zipfile.BadZipFile, OSError) as exc:
        raise ZipError("le fichier n'est pas un ZIP valide (peut-être abîmé pendant l'envoi ?)") from exc

    with archive, tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        entries = parse_manifest(archive)

        # Phase 1: extract + transcode everything into the temp dir.
        transcoded = []  # (line_id, tmp_mp3_path, raw_text)
        for line_id, file_name, text in entries:
            raw = tmp_dir / f"in-{file_name}"
            raw.write_bytes(read_member_capped(archive, file_name, MAX_CLIP_BYTES))
            out = tmp_dir / f"{line_id}.mp3"
            transcode(raw, out)
            transcoded.append((line_id, out, text))

        # Phase 2: everything succeeded — publish atomically-ish.
        for line_id, out, text in transcoded:
            shutil.move(str(out), str(CLIPS_DIR / f"{line_id}.mp3"))
            # Raw text at recording time; compared after normalization
            # by build_manifest.py.
            clips_index[line_id] = text
        return len(transcoded)


def main() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)
    try:
        clips_index = json.loads(CLIPS_JSON.read_text(encoding="utf-8")) if CLIPS_JSON.exists() else {}
        if not isinstance(clips_index, dict):
            clips_index = {}
    except json.JSONDecodeError:
        print("data/clips.json illisible — reparti de zéro", file=sys.stderr)
        clips_index = {}

    zips = sorted(p for p in UPLOADS_DIR.iterdir() if p.suffix.lower() == ".zip" and p.is_file())

    if zips and shutil.which("ffmpeg") is None:
        print("ffmpeg introuvable", file=sys.stderr)
        sys.exit(1)

    errors = []
    total = 0
    for zip_path in zips:
        try:
            count = process_zip(zip_path, clips_index)
            total += count
            print(f"{zip_path.name}: {count} clip(s) traités")
        except ZipError as exc:
            errors.append({"file": zip_path.name, "error": str(exc)})
            print(f"{zip_path.name}: ERREUR — {exc}", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001 — one bad ZIP must not sink the run
            errors.append({"file": zip_path.name, "error": f"erreur inattendue ({type(exc).__name__})"})
            print(f"{zip_path.name}: ERREUR INATTENDUE — {exc!r}", file=sys.stderr)
        finally:
            # Processed or faulty, the ZIP leaves the drop zone: merges are
            # idempotent by line id, and a broken file must not fail forever.
            try:
                zip_path.unlink(missing_ok=True)
            except OSError as exc:
                print(f"{zip_path.name}: suppression impossible — {exc}", file=sys.stderr)

    write_json(CLIPS_JSON, clips_index, sort_keys=True)

    if errors:
        write_json(ERRORS_PATH, errors)
    print(f"Terminé : {len(zips)} ZIP(s), {total} clip(s), {len(errors)} erreur(s)")


if __name__ == "__main__":
    main()
