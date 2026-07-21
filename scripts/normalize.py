"""Text normalization used to detect stale recordings (status "perime").

This is the ONLY implementation: the browser never normalizes anything (the
recorder ships RAW text in its ZIP), so there is no cross-language twin to
keep in sync. Both sides of the comparison are normalized here, in the
GitHub Action, at manifest-build time.

Rules (see project spec §6):
 - lowercase
 - curly apostrophes/dashes unified to straight ones
 - punctuation removed (replaced by a space), EXCEPT apostrophes and hyphens,
   which are meaningful inside French words ("l'crâne", "mettez-vous")
 - accents and words are KEPT
 - whitespace collapsed to single spaces, trimmed
"""

import re
import unicodedata

_UNIFY = str.maketrans({"’": "'", "‘": "'", "ʼ": "'", "–": "-", "—": "-"})


# Keep Unicode letters and numbers (plus ' - and whitespace); everything else
# becomes a space.
def _keep(char: str) -> bool:
    if char in "'-" or char.isspace():
        return True
    category = unicodedata.category(char)
    return category.startswith("L") or category.startswith("N")


def normalize_text(text: str) -> str:
    text = text.lower().translate(_UNIFY)
    text = "".join(char if _keep(char) else " " for char in text)
    return re.sub(r"\s+", " ", text).strip()
