"""Normalization test cases (the single implementation lives in Python)."""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from normalize import normalize_text

CASES_PATH = Path(__file__).resolve().parent / "normalize-cases.json"


class TestNormalizeSharedCases(unittest.TestCase):
    def test_shared_cases(self):
        cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
        self.assertGreater(len(cases), 0)
        for case in cases:
            with self.subTest(case["name"]):
                self.assertEqual(normalize_text(case["input"]), case["expected"])

    def test_idempotent(self):
        cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
        for case in cases:
            normalized = normalize_text(case["input"])
            self.assertEqual(normalize_text(normalized), normalized)


if __name__ == "__main__":
    unittest.main()
