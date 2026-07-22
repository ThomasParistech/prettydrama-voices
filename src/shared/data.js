// Data loading shared by all pages.
//
// Pages read ONLY data/manifest.json (+ mp3 clips) — except the editor, which
// also reads data/script.json (the source of truth it produces).

// Distinguishes "file does not exist" (404 → legitimate empty start) from
// "file exists but is unreadable" (parse error → must NOT be treated as
// empty, or the user could overwrite real data).
export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} sur ${url}`);
    this.status = status;
  }
}

export async function fetchJson(relativeUrl) {
  const res = await fetch(`${relativeUrl}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new HttpError(res.status, relativeUrl);
  try {
    return await res.json();
  } catch {
    throw new Error(`Fichier illisible (JSON invalide) : ${relativeUrl}`);
  }
}

export function fetchManifest() {
  return fetchJson("data/manifest.json");
}

export function fetchScript() {
  return fetchJson("data/script.json");
}

export const MANIFEST_ERROR_MESSAGE =
  "Impossible de charger la pièce. Le site n'est peut-être pas encore publié — " +
  "réessayez dans quelques minutes ou contactez votre responsable.";

// Numérotation « (n/total) » de mes répliques dans la scène courante,
// partagée par les pages Répétition et Enregistrement : Map lineId -> n
// (1-based) ; `size` donne le total.
export function myLineNumbers(lines, characterId) {
  const numbers = new Map();
  if (characterId === "") return numbers;
  let n = 0;
  for (const line of lines) {
    if (line.characterId === characterId) numbers.set(line.id, ++n);
  }
  return numbers;
}

// Warn before closing the tab when there is unsaved in-memory work.
export function setBeforeUnloadGuard(enabled) {
  window.onbeforeunload = enabled
    ? (e) => {
        e.preventDefault();
        // Modern browsers show their own generic message; returnValue is
        // required for the prompt to appear.
        e.returnValue = "";
        return "";
      }
    : null;
}

// Trigger a browser download of a Blob.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// "Serge" -> "serge", "Éléonore d'Aquitaine" -> "eleonore-d-aquitaine"
// (used only for the ZIP filename — readability, not identity)
export function slugify(name) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "personnage"
  );
}
