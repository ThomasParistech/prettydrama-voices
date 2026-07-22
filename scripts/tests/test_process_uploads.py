"""parse_manifest tests: the ZIP contract (bare {line id: raw text} manifest
+ one {id}.{ext} audio member per line) — hostile ZIPs raise ZipError, never
anything else."""

import io
import json
import sys
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from process_uploads import MAX_CLIPS_PER_ZIP, ZipError, parse_manifest


def make_archive(members: dict, manifest=None):
    """In-memory ZIP: members = {name: bytes}; manifest (if not None) is
    JSON-dumped into manifest.json."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        if manifest is not None:
            zf.writestr("manifest.json", json.dumps(manifest))
        for name, data in members.items():
            zf.writestr(name, data)
    buffer.seek(0)
    return zipfile.ZipFile(buffer)


class TestParseManifest(unittest.TestCase):
    def test_valid_zip_returns_id_member_text_triples(self):
        archive = make_archive(
            {"aaaa-1111.webm": b"x", "bbbb-2222.mp4": b"x"},
            manifest={"aaaa-1111": "Silence !", "bbbb-2222": "J'suis malade."},
        )
        self.assertEqual(
            sorted(parse_manifest(archive)),
            [
                ("aaaa-1111", "aaaa-1111.webm", "Silence !"),
                ("bbbb-2222", "bbbb-2222.mp4", "J'suis malade."),
            ],
        )

    def test_missing_manifest_is_rejected(self):
        archive = make_archive({"aaaa-1111.webm": b"x"})
        with self.assertRaises(ZipError):
            parse_manifest(archive)

    def test_manifest_not_json_is_rejected(self):
        archive = make_archive({"manifest.json": b"not json", "aaaa-1111.webm": b"x"})
        with self.assertRaises(ZipError):
            parse_manifest(archive)

    def test_old_clips_list_format_is_rejected(self):
        # Pre-{id: text} format ({character, clips: [...]}) : text values are
        # not strings -> rejected, never crashes.
        archive = make_archive(
            {"aaaa-1111.webm": b"x"},
            manifest={"character": "Serge", "clips": [{"id": "aaaa-1111", "file": "aaaa-1111.webm"}]},
        )
        with self.assertRaises(ZipError):
            parse_manifest(archive)

    def test_invalid_line_id_is_rejected(self):
        archive = make_archive(
            {"evil.webm": b"x"}, manifest={"../evil": "texte"}
        )
        with self.assertRaises(ZipError):
            parse_manifest(archive)

    def test_non_string_text_is_rejected(self):
        archive = make_archive({"aaaa-1111.webm": b"x"}, manifest={"aaaa-1111": 42})
        with self.assertRaises(ZipError):
            parse_manifest(archive)

    def test_missing_audio_member_is_rejected(self):
        archive = make_archive({}, manifest={"aaaa-1111": "texte"})
        with self.assertRaises(ZipError):
            parse_manifest(archive)

    def test_duplicate_audio_members_are_rejected(self):
        archive = make_archive(
            {"aaaa-1111.webm": b"x", "aaaa-1111.mp4": b"x"},
            manifest={"aaaa-1111": "texte"},
        )
        with self.assertRaises(ZipError):
            parse_manifest(archive)

    def test_audio_member_with_path_or_odd_extension_is_not_matched(self):
        # fullmatch keeps member names free of path tricks: "sub/aaaa-1111.webm"
        # or "aaaa-1111.webm/../x" never match the id.
        archive = make_archive(
            {"sub/aaaa-1111.webm": b"x"}, manifest={"aaaa-1111": "texte"}
        )
        with self.assertRaises(ZipError):
            parse_manifest(archive)

    def test_extra_unrelated_members_are_ignored(self):
        archive = make_archive(
            {"aaaa-1111.webm": b"x", "__MACOSX/junk": b"x", "notes.txt": b"x"},
            manifest={"aaaa-1111": "texte"},
        )
        self.assertEqual(parse_manifest(archive), [("aaaa-1111", "aaaa-1111.webm", "texte")])

    def test_too_many_clips_is_rejected(self):
        manifest = {f"id-{i}": "t" for i in range(MAX_CLIPS_PER_ZIP + 1)}
        archive = make_archive({}, manifest=manifest)
        with self.assertRaises(ZipError):
            parse_manifest(archive)


if __name__ == "__main__":
    unittest.main()
