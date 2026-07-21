import React, { useMemo, useState, useCallback, useEffect } from "react";
import JSZip from "jszip";
import PageHeader from "../shared/PageHeader.jsx";
import {
  setBeforeUnloadGuard,
  downloadBlob,
  slugify,
  linesForCharacter,
  STATUS_LABELS,
} from "../shared/data.js";
import useManifest from "../shared/useManifest.js";
import useRecorder, { extensionForMimeType } from "./useRecorder.js";
import "./recorder.css";

export default function App() {
  const { manifest, error: loadError } = useManifest();
  const [characterId, setCharacterId] = useState(null);
  // In-memory takes of this one-shot session: lineId -> {blob, ext, text, url}
  const [takes, setTakes] = useState({});
  const [downloaded, setDownloaded] = useState(false);

  const { supported, recordingLineId, error: micError, start, stop, release } = useRecorder();

  // Guard: takes only live in memory. Warn before closing if any take has
  // not been exported yet.
  const takenCount = Object.keys(takes).length;
  const hasUnexported = takenCount > 0 && !downloaded;
  useEffect(() => {
    setBeforeUnloadGuard(hasUnexported);
    return () => setBeforeUnloadGuard(false);
  }, [hasUnexported]);

  const character = useMemo(
    () => manifest?.characters.find((c) => c.id === characterId) ?? null,
    [manifest, characterId]
  );

  // The character's lines, grouped by act/scene using the manifest's own
  // hierarchy (no re-derivation from the flat list).
  const groups = useMemo(() => {
    if (!manifest || characterId == null) return [];
    const result = [];
    for (const act of manifest.acts) {
      for (const scene of act.scenes) {
        const lines = scene.lines.filter((l) => l.characterId === characterId);
        if (lines.length > 0) result.push({ key: `${act.title} — ${scene.title}`, lines });
      }
    }
    return result;
  }, [manifest, characterId]);

  const clearTakes = useCallback(() => {
    setTakes((prev) => {
      Object.values(prev).forEach((take) => take.url && URL.revokeObjectURL(take.url));
      return {};
    });
    setDownloaded(false);
  }, []);

  // Takes belong to ONE character: switching characters with unexported
  // takes would export them under the wrong name — confirm, then clear.
  const changeCharacter = () => {
    if (
      hasUnexported &&
      !window.confirm(
        "Vos enregistrements n'ont pas été téléchargés et seront perdus si vous changez de personnage. Continuer ?"
      )
    ) {
      return;
    }
    clearTakes();
    setCharacterId(null);
  };

  const saveTake = (line, blob, mimeType) => {
    if (!blob || blob.size === 0) return;
    setTakes((prev) => {
      // A single take per line: replace (and free) the previous one.
      if (prev[line.id]?.url) URL.revokeObjectURL(prev[line.id].url);
      return {
        ...prev,
        [line.id]: {
          blob,
          ext: extensionForMimeType(mimeType),
          // RAW text captured at recording time — no normalization in the
          // browser (single implementation lives in the GitHub Action, which
          // normalizes both sides when comparing).
          text: line.text,
          url: URL.createObjectURL(blob),
        },
      };
    });
    setDownloaded(false);
  };

  const deleteTake = (lineId) => {
    setTakes((prev) => {
      if (prev[lineId]?.url) URL.revokeObjectURL(prev[lineId].url);
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    const clips = Object.entries(takes).map(([lineId, take]) => {
      const file = `${lineId}.${take.ext}`;
      zip.file(file, take.blob);
      return { id: lineId, file, text: take.text };
    });
    zip.file(
      "manifest.json",
      JSON.stringify({ character: character.name, clips }, null, 2)
    );
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `voix-${slugify(character.name)}.zip`);
    setDownloaded(true);
    // Recording session is over: turn the mic-in-use indicator off.
    // (Recording again simply reopens the stream.)
    release();
  };

  if (loadError) {
    return (
      <>
        <PageHeader title="Enregistrement" />
        <div className="empty-state">{loadError}</div>
      </>
    );
  }

  if (!manifest) {
    return (
      <>
        <PageHeader title="Enregistrement" />
        <div className="loading-state">Chargement de la pièce…</div>
      </>
    );
  }

  if (!supported) {
    return (
      <>
        <PageHeader title="Enregistrement" />
        <div className="empty-state">
          Votre navigateur ne permet pas d'enregistrer du son. Essayez avec une version récente de
          Chrome, Firefox ou Safari.
        </div>
      </>
    );
  }

  // ---- Step 1: pick your character ----
  if (!character) {
    return (
      <>
        <PageHeader title="Enregistrement — vos répliques" />
        <div className="container">
          <h1 className="pick-title">{manifest.title}</h1>
          <p className="pick-subtitle">Qui êtes-vous ? Choisissez votre personnage :</p>
          <div className="character-grid">
            {manifest.characters.map((c) => {
              const lines = linesForCharacter(manifest, c.id);
              const todo = lines.filter((l) => l.status !== "ok").length;
              return (
                <button key={c.id} className="character-card card" onClick={() => setCharacterId(c.id)}>
                  <span className="character-card-name">{c.name}</span>
                  <span className="character-card-info">
                    {lines.length} réplique{lines.length > 1 ? "s" : ""}
                    {todo > 0 ? ` — ${todo} à faire` : " — tout est enregistré 🎉"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ---- Step 2: record your lines ----
  return (
    <>
      <PageHeader title={`Enregistrement — ${character.name}`}>
        <button className="btn small" onClick={changeCharacter}>
          Changer de personnage
        </button>
      </PageHeader>

      <div className="container recorder-container">
        <div className="recorder-intro card">
          <p>
            <strong>{character.name}</strong>, voici vos répliques. Appuyez sur 🎙️ pour enregistrer,
            réécoutez, recommencez si besoin. Quand vous avez fini (même partiellement), téléchargez
            votre fichier et envoyez-le à votre responsable (mail, WhatsApp… peu importe).
          </p>
          {micError && <p className="mic-error">{micError}</p>}
        </div>

        {groups.length === 0 && <div className="empty-state">Ce personnage n'a aucune réplique.</div>}
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="group-title">{g.key}</h2>
            {g.lines.map((line) => (
              <LineCard
                key={line.id}
                line={line}
                take={takes[line.id]}
                isRecording={recordingLineId === line.id}
                anotherRecording={recordingLineId != null && recordingLineId !== line.id}
                onRecord={async () => {
                  if (recordingLineId === line.id) {
                    const result = await stop();
                    if (result) saveTake(line, result.blob, result.mimeType);
                  } else {
                    if (recordingLineId != null) await stop(); // safety: stop a stray take
                    try {
                      await start(line.id);
                    } catch {
                      /* mic denied: error is displayed above */
                    }
                  }
                }}
                onDeleteTake={() => deleteTake(line.id)}
              />
            ))}
          </section>
        ))}

        <div className="zip-bar">
          {hasUnexported && (
            <span className="zip-warning">
              ⚠️ Vos enregistrements ne sont PAS sauvegardés tant que vous n'avez pas téléchargé le
              fichier.
            </span>
          )}
          {downloaded && takenCount > 0 && (
            <span className="zip-done">✓ Fichier téléchargé — envoyez-le à votre responsable.</span>
          )}
          <button className="btn primary zip-btn" disabled={takenCount === 0} onClick={downloadZip}>
            ⬇ Télécharger mon fichier ({takenCount} enregistrement{takenCount > 1 ? "s" : ""})
          </button>
        </div>
      </div>
    </>
  );
}

function LineCard({ line, take, isRecording, anotherRecording, onRecord, onDeleteTake }) {
  return (
    <div className={`line-card card ${isRecording ? "recording" : ""}`}>
      <div className="line-card-top">
        {take ? (
          <span className="badge ok">🎙️ Enregistré — à envoyer</span>
        ) : (
          <span className={`badge ${line.status}`}>
            {STATUS_LABELS[line.status]}
            {line.status === "perime" ? " (le texte a changé)" : ""}
          </span>
        )}
      </div>

      <p className="line-card-text">{line.text}</p>

      <div className="line-card-actions">
        <button
          className={`btn record-btn ${isRecording ? "stop" : ""}`}
          disabled={anotherRecording}
          onClick={onRecord}
        >
          {isRecording ? "⏹ Terminer" : take ? "🎙️ Refaire" : "🎙️ Enregistrer"}
        </button>

        {take && !isRecording && (
          <>
            <audio src={take.url} controls preload="metadata" className="take-audio" />
            <button className="btn icon" title="Supprimer cette prise" onClick={onDeleteTake}>
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}
