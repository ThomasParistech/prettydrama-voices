import React, { useState } from "react";
import { newId } from "./reducer.js";

// Hue derived from the stable character id (a UUID string) — consistent
// visual identity across the whole editor without any stored color.
export function characterHue(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return ((hash % 360) + 360) % 360;
}

// Side panel: the character referential. Lines only ever reference these
// entries by id, so renames propagate everywhere and never touch line ids.
export default function CharacterPanel({ characters, lineCounts, dispatch, onRequestDelete }) {
  const [newName, setNewName] = useState("");

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    dispatch({ type: "ADD_CHARACTER", id: newId(), name });
    setNewName("");
  };

  return (
    <aside className="character-panel">
      <h2>Personnages</h2>
      <p className="panel-hint">
        Ajoutez ici les personnages de la pièce, puis choisissez-les dans chaque réplique.
      </p>

      <ul className="character-list">
        {characters.map((c) => (
          <CharacterRow
            key={c.id}
            character={c}
            lineCount={lineCounts.get(c.id) ?? 0}
            onRename={(name) => dispatch({ type: "RENAME_CHARACTER", id: c.id, name })}
            onDelete={() => onRequestDelete(c)}
          />
        ))}
        {characters.length === 0 && (
          <li className="character-empty">Aucun personnage pour l'instant.</li>
        )}
      </ul>

      <form
        className="character-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          type="text"
          placeholder="Nom du personnage"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn small" disabled={!newName.trim()}>
          + Ajouter
        </button>
      </form>
    </aside>
  );
}

function CharacterRow({ character, lineCount, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(character.name);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== character.name) onRename(draft);
    else setDraft(character.name);
  };

  return (
    <li className="character-row">
      <span className="character-dot" style={{ background: `hsl(${characterHue(character.id)}, 55%, 55%)` }} />
      {editing ? (
        <input
          type="text"
          className="character-rename-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(character.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button className="character-name" title="Renommer" onClick={() => setEditing(true)}>
          {character.name}
        </button>
      )}
      <span className="character-count">{lineCount}</span>
      <button className="btn icon small" title="Supprimer ce personnage" onClick={onDelete}>
        ✕
      </button>
    </li>
  );
}
