"""Build data/manifest.json — the single file the app pages read.

Stateless join of data/script.json (source of truth, produced by the editor)
and data/clips.json (state of processed clips, maintained by process_uploads).

Status per line (spec §6):
 - clip exists and normalized text matches  -> "ok"
 - clip exists but normalized text differs  -> "perime"   ("À refaire")
 - no clip for this line id                 -> "manquant" ("À enregistrer")

Orphan clips (id no longer present in the script) are simply not part of the
manifest: the mp3 may linger in clips/ but is never served to the app.

script.json is hand-uploadable (and hand-editable) on github.com, so this
script must tolerate the same malformed entries the editor's sanitizeScript
tolerates — a missing key must never crash the whole workflow run.
"""

import json
import sys
from pathlib import Path

from common import REPO_ROOT, write_json
from normalize import normalize_text

SCRIPT_PATH = REPO_ROOT / "data" / "script.json"
CLIPS_PATH = REPO_ROOT / "data" / "clips.json"
MANIFEST_PATH = REPO_ROOT / "data" / "manifest.json"


def _is_id(value) -> bool:
    return isinstance(value, str) and len(value) > 0


def sanitize_script(raw: dict) -> dict:
    """Lenient mirror of the editor's sanitizeScript: drop malformed entries
    instead of crashing on them (the two consumers must agree on tolerance)."""
    if not isinstance(raw, dict):
        raw = {}
    characters = [
        {"id": c["id"], "name": c["name"]}
        for c in (raw.get("characters") or [])
        if isinstance(c, dict) and _is_id(c.get("id")) and isinstance(c.get("name"), str)
    ]
    acts = []
    for act in raw.get("acts") or []:
        if not isinstance(act, dict):
            continue
        scenes = []
        for scene in act.get("scenes") or []:
            if not isinstance(scene, dict):
                continue
            lines = []
            for line in scene.get("lines") or []:
                if not isinstance(line, dict) or not _is_id(line.get("id")):
                    continue
                lines.append(
                    {
                        "id": line["id"],
                        "characterId": line["characterId"] if _is_id(line.get("characterId")) else None,
                        "text": line["text"] if isinstance(line.get("text"), str) else "",
                    }
                )
            scenes.append(
                {"title": scene["title"] if isinstance(scene.get("title"), str) else "", "lines": lines}
            )
        acts.append({"title": act["title"] if isinstance(act.get("title"), str) else "", "scenes": scenes})
    return {
        "title": raw.get("title") if isinstance(raw.get("title"), str) else "",
        "characters": characters,
        "acts": acts,
    }


def compute_status(line: dict, clips: dict) -> str:
    recorded_text = clips.get(line["id"])
    if not isinstance(recorded_text, str):
        return "manquant"
    # Both sides are RAW text (current script vs text at recording time);
    # normalization happens here and only here — single implementation, no
    # cross-language mismatch possible.
    if normalize_text(line["text"]) == normalize_text(recorded_text):
        return "ok"
    return "perime"


def build_manifest(script: dict, clips: dict) -> dict:
    script = sanitize_script(script)
    if not isinstance(clips, dict):
        clips = {}
    names = {c["id"]: c["name"] for c in script["characters"]}

    def enrich(line: dict, act_title: str, scene_title: str) -> dict:
        status = compute_status(line, clips)
        return {
            "id": line["id"],
            "characterId": line["characterId"],
            "character": names.get(line["characterId"], "?"),
            "text": line["text"],
            "status": status,
            "clip": f"clips/{line['id']}.mp3" if status != "manquant" else None,
            "act": act_title,
            "scene": scene_title,
        }

    acts = []
    flat_lines = []
    for act in script["acts"]:
        scenes = []
        for scene in act["scenes"]:
            lines = [enrich(line, act["title"], scene["title"]) for line in scene["lines"]]
            flat_lines.extend(lines)
            scenes.append({"title": scene["title"], "lines": lines})
        acts.append({"title": act["title"], "scenes": scenes})

    return {
        "title": script["title"],
        "characters": script["characters"],
        "acts": acts,
        "lines": flat_lines,
    }


def main() -> None:
    try:
        script = json.loads(SCRIPT_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print("data/script.json introuvable", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(
            f"data/script.json n'est pas un JSON valide ({exc}) — restaurez sa version "
            "précédente depuis l'historique GitHub ou re-téléchargez-le depuis l'éditeur.",
            file=sys.stderr,
        )
        sys.exit(1)
    try:
        clips = json.loads(CLIPS_PATH.read_text(encoding="utf-8")) if CLIPS_PATH.exists() else {}
    except json.JSONDecodeError:
        # clips.json is machine-written; if somehow corrupted, rebuild from
        # scratch rather than blocking the site (statuses degrade to
        # "manquant" until ZIPs are re-merged).
        print("data/clips.json illisible — ignoré (statuts recalculés sans lui)", file=sys.stderr)
        clips = {}
    manifest = build_manifest(script, clips)
    write_json(MANIFEST_PATH, manifest)
    total = len(manifest["lines"])
    ok = sum(1 for l in manifest["lines"] if l["status"] == "ok")
    print(f"manifest.json written: {total} lines, {ok} recorded")


if __name__ == "__main__":
    main()
