"""Update the build-status section of README.md (between the two markers).

Usage: python scripts/update_readme_status.py ok|ko|warn
The respo never reads CI logs — the README states plainly whether the last
processing worked.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
README = REPO_ROOT / "README.md"
START = "<!-- BUILD_STATUS_START -->"
END = "<!-- BUILD_STATUS_END -->"

MESSAGES = {
    "ok": "✅ **Dernier traitement réussi** — tout est en ligne.",
    "warn": (
        "⚠️ **Dernier traitement terminé avec des erreurs** — certains fichiers n'ont pas pu être "
        "traités. Regardez l'onglet **Issues** ci-dessus pour savoir quoi faire."
    ),
    "ko": (
        "❌ **Le dernier traitement a échoué** — le site n'a pas été mis à jour. Regardez l'onglet "
        "**Issues** ci-dessus pour savoir quoi faire."
    ),
}


def main() -> None:
    status = sys.argv[1] if len(sys.argv) > 1 else "ok"
    stamp = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
    block = f"{START}\n{MESSAGES[status]}\n\n_Mis à jour le {stamp}._\n{END}"

    content = README.read_text(encoding="utf-8")
    start_idx = content.find(START)
    end_idx = content.find(END)
    if start_idx == -1 or end_idx == -1:
        print("README markers not found; skipping status update", file=sys.stderr)
        return
    content = content[:start_idx] + block + content[end_idx + len(END):]
    README.write_text(content, encoding="utf-8")
    print(f"README status set to {status}")


if __name__ == "__main__":
    main()
