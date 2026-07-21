"""Turn uploads_errors.json into a clear French GitHub-issue body (markdown),
printed on stdout. Used by the workflow when some ZIPs could not be processed.

Error entries embed ZIP-controlled fragments (filename, manifest excerpts,
ffmpeg output), so everything untrusted is rendered inside code spans (no
live markdown, links or @-mentions) and length-capped.
"""

import json

from common import REPO_ROOT

ERRORS_PATH = REPO_ROOT / "uploads_errors.json"


def code_span(text, limit: int = 300) -> str:
    """Neutralize untrusted text: single line, no backticks, capped, then
    wrapped in a markdown code span."""
    text = " ".join(str(text).replace("`", "'").split())
    if len(text) > limit:
        text = text[:limit] + "…"
    return f"`{text or '?'}`"


def main() -> None:
    errors = json.loads(ERRORS_PATH.read_text(encoding="utf-8"))
    lines = [
        "Bonjour ! 👋",
        "",
        "Certains fichiers de voix déposés dans `uploads/voix/` n'ont pas pu être traités :",
        "",
    ]
    for err in errors:
        lines.append(f"- {code_span(err.get('file'), 100)} : {code_span(err.get('error'))}")
    lines += [
        "",
        "**Que faire ?**",
        "1. Demandez à l'acteur ou l'actrice concerné·e de refaire son enregistrement sur la page "
        "« Enregistrement » du site et de vous renvoyer le fichier ZIP.",
        "2. Déposez le nouveau fichier dans le dossier `uploads/voix/` du dépôt.",
        "3. Vous pouvez ensuite fermer cette issue (bouton « Close issue » en bas).",
        "",
        "Les fichiers en erreur ont été retirés automatiquement, et aucun de leurs enregistrements "
        "n'a été conservé (un fichier est pris en compte en entier, ou pas du tout). Les autres "
        "fichiers déposés en même temps ont bien été traités.",
    ]
    print("\n".join(lines))


if __name__ == "__main__":
    main()
