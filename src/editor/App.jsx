import React, { useEffect, useMemo, useReducer, useState, useCallback } from "react";
import PageHeader from "../shared/PageHeader.jsx";
import { fetchScript, setBeforeUnloadGuard, downloadBlob, HttpError } from "../shared/data.js";
import { scriptReducer, EMPTY_SCRIPT, allLines, newId } from "./reducer.js";
import CharacterPanel from "./CharacterPanel.jsx";
import ActEditor from "./ActEditor.jsx";
import "./editor.css";

export default function App() {
  const [script, rawDispatch] = useReducer(scriptReducer, EMPTY_SCRIPT);
  const [loading, setLoading] = useState(true);
  const [loadInfo, setLoadInfo] = useState("");
  // Blocking error: the published script EXISTS but could not be read.
  // Starting empty here would let the respo overwrite the real play.
  const [loadError, setLoadError] = useState(null);
  const [dirty, setDirty] = useState(false);
  // Line id whose textarea should grab focus (set right after ADD_LINE).
  const [focusLineId, setFocusLineId] = useState(null);
  // Pending character deletion needing a decision (has lines).
  const [deleteRequest, setDeleteRequest] = useState(null);

  const dispatch = useCallback((action) => {
    rawDispatch(action);
    if (action.type !== "LOAD_SCRIPT") setDirty(true);
  }, []);

  // "Reprise" mode: load the published script.json to continue editing it.
  useEffect(() => {
    let cancelled = false;
    fetchScript()
      .then((raw) => {
        if (cancelled) return;
        rawDispatch({ type: "LOAD_SCRIPT", script: raw });
        setLoadInfo("Script publié chargé — vous continuez l'édition de la dernière version en ligne.");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof HttpError && err.status === 404) {
          // Genuinely no published script yet: legitimate empty start.
          setLoadInfo("Aucun script publié trouvé — vous partez d'une pièce vide.");
        } else {
          setLoadError(
            "Le script publié existe mais n'a pas pu être lu (fichier abîmé ou problème réseau). " +
              "Pour ne pas risquer d'écraser votre pièce, l'éditeur est désactivé. " +
              "Rechargez la page pour réessayer ; si l'erreur persiste, le fichier data/script.json " +
              "du dépôt est probablement abîmé — restaurez sa version précédente depuis l'historique GitHub " +
              "(History → bouton « ... » → View file → Raw) avant de continuer."
          );
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // One-shot session guard: warn before losing unsaved edits.
  useEffect(() => {
    setBeforeUnloadGuard(dirty);
    return () => setBeforeUnloadGuard(false);
  }, [dirty]);

  const download = () => {
    const blob = new Blob([JSON.stringify(script, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, "script.json");
    setDirty(false);
  };

  // Insert a new line and focus it: the UUID is minted here (not in the
  // reducer, which must stay pure) so we know which textarea to focus.
  // The default character (alternation) is computed by the reducer.
  const addLine = useCallback(
    (actIndex, sceneIndex, afterLineId) => {
      const id = newId();
      dispatch({ type: "ADD_LINE", id, actIndex, sceneIndex, afterLineId });
      setFocusLineId(id);
    },
    [dispatch]
  );

  // Stable identity: LineRow uses it in an effect dependency list.
  const handleFocusHandled = useCallback(() => setFocusLineId(null), []);

  // One O(lines) pass instead of one full-script scan per character per render.
  const lineCounts = useMemo(() => {
    const counts = new Map();
    for (const line of allLines(script)) {
      if (line.characterId != null) {
        counts.set(line.characterId, (counts.get(line.characterId) ?? 0) + 1);
      }
    }
    return counts;
  }, [script]);

  const requestDeleteCharacter = useCallback(
    (character) => {
      const count = lineCounts.get(character.id) ?? 0;
      if (count === 0) {
        dispatch({ type: "DELETE_CHARACTER", id: character.id, mode: "deleteLines" });
      } else {
        setDeleteRequest({ character, count });
      }
    },
    [dispatch, lineCounts]
  );

  if (loading) {
    return (
      <>
        <PageHeader title="Éditeur" />
        <div className="loading-state">Chargement du script…</div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Éditeur" />
        <div className="empty-state load-error">⚠️ {loadError}</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Éditeur — saisie de la pièce">
        {dirty && <span className="dirty-hint">Modifications non téléchargées</span>}
        <button className="btn primary" onClick={download}>
          ⬇ Télécharger le script
        </button>
      </PageHeader>

      <div className="editor-layout">
        <CharacterPanel
          characters={script.characters}
          lineCounts={lineCounts}
          dispatch={dispatch}
          onRequestDelete={requestDeleteCharacter}
        />

        <main className="editor-main">
          <p className="load-info">{loadInfo}</p>

          <input
            type="text"
            className="play-title-input"
            placeholder="Titre de la pièce"
            value={script.title}
            onChange={(e) => dispatch({ type: "SET_TITLE", title: e.target.value })}
          />

          {script.acts.map((act, actIndex) => (
            <ActEditor
              key={actIndex}
              act={act}
              actIndex={actIndex}
              actCount={script.acts.length}
              characters={script.characters}
              dispatch={dispatch}
              addLine={addLine}
              focusLineId={focusLineId}
              onFocusHandled={handleFocusHandled}
            />
          ))}

          <button className="btn add-act-btn" onClick={() => dispatch({ type: "ADD_ACT" })}>
            + Ajouter un acte
          </button>

          <div className="editor-footer-hint">
            Quand vous avez terminé : cliquez sur <strong>« Télécharger le script »</strong> en haut,
            puis déposez le fichier <code>script.json</code> dans le dossier <code>data/</code> de
            votre dépôt GitHub (il remplacera l'ancien).
          </div>
        </main>
      </div>

      {deleteRequest && (
        <DeleteCharacterModal
          request={deleteRequest}
          characters={script.characters}
          onCancel={() => setDeleteRequest(null)}
          onConfirm={(mode, reassignTo) => {
            dispatch({ type: "DELETE_CHARACTER", id: deleteRequest.character.id, mode, reassignTo });
            setDeleteRequest(null);
          }}
        />
      )}
    </>
  );
}

// Guard against ghost data: a character that still owns lines cannot be
// silently removed — the user chooses to reassign or delete those lines.
function DeleteCharacterModal({ request, characters, onCancel, onConfirm }) {
  const others = characters.filter((c) => c.id !== request.character.id);
  const [reassignTo, setReassignTo] = useState(others[0]?.id ?? null);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Supprimer « {request.character.name} » ?</h3>
        <p>
          Ce personnage a encore <strong>{request.count} réplique{request.count > 1 ? "s" : ""}</strong>.
          Que faut-il en faire ?
        </p>
        {others.length > 0 && (
          <label className="reassign-row">
            Réassigner à&nbsp;:
            <select value={reassignTo ?? ""} onChange={(e) => setReassignTo(e.target.value)}>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn danger" onClick={() => onConfirm("deleteLines")}>
            Supprimer ses répliques
          </button>
          {others.length > 0 && (
            <button className="btn primary" onClick={() => onConfirm("reassign", reassignTo)}>
              Réassigner
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
