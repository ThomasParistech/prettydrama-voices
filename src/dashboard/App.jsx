import React, { useState } from "react";
import PageHeader from "../shared/PageHeader.jsx";
import { linesForCharacter, STATUS_LABELS } from "../shared/data.js";
import useManifest from "../shared/useManifest.js";
import "./dashboard.css";

// Pure read of data/manifest.json: recording progress per character, so the
// respo knows who to chase.
export default function App() {
  const { manifest, error: loadError } = useManifest();
  if (loadError) {
    return (
      <>
        <PageHeader title="Avancement" />
        <div className="empty-state">{loadError}</div>
      </>
    );
  }
  if (!manifest) {
    return (
      <>
        <PageHeader title="Avancement" />
        <div className="loading-state">Chargement de la pièce…</div>
      </>
    );
  }
  return <Dashboard manifest={manifest} />;
}

function Dashboard({ manifest }) {
  const rows = manifest.characters.map((c) => {
    const lines = linesForCharacter(manifest, c.id);
    const count = (status) => lines.filter((l) => l.status === status).length;
    return {
      character: c,
      total: lines.length,
      ok: count("ok"),
      perime: count("perime"),
      manquant: count("manquant"),
      pending: lines.filter((l) => l.status !== "ok"),
    };
  });

  // Lines pointing at no (known) character: they inflate the totals but
  // belong to nobody and NOBODY can record them — surface them loudly so the
  // respo fixes the script instead of chasing a phantom "41/42".
  const knownIds = new Set(manifest.characters.map((c) => c.id));
  const orphanLines = manifest.lines.filter(
    (l) => l.characterId == null || !knownIds.has(l.characterId)
  );

  const totalLines = manifest.lines.length;
  const totalOk = manifest.lines.filter((l) => l.status === "ok").length;

  return (
    <>
      <PageHeader title="Avancement des enregistrements" />
      <div className="container">
        <h1 className="dash-title">{manifest.title || "Pièce sans titre"}</h1>
        <p className="dash-global">
          {totalOk} / {totalLines} répliques enregistrées
        </p>
        <ProgressBar value={totalOk} max={totalLines} className="dash-global-bar" />

        {orphanLines.length > 0 && (
          <div className="dash-orphans card">
            ⚠️ <strong>{orphanLines.length} réplique{orphanLines.length > 1 ? "s" : ""} sans
            personnage valide</strong> — personne ne peut les enregistrer. Ouvrez l'éditeur et
            assignez-leur un personnage.
            <ul>
              {orphanLines.map((l) => (
                <li key={l.id}>
                  <span className="dash-pending-loc">
                    {l.act} · {l.scene}
                  </span>{" "}
                  <span className="dash-pending-text">{l.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rows.length === 0 && (
          <div className="empty-state">
            Aucun personnage pour l'instant — la pièce doit d'abord être saisie dans l'éditeur.
          </div>
        )}

        {rows.map((row) => (
          <CharacterProgress key={row.character.id} row={row} />
        ))}
      </div>
    </>
  );
}

// Single track+fill bar used everywhere in the dashboard.
function ProgressBar({ value, max, className }) {
  return (
    <div className={`dash-bar ${className || ""}`}>
      <div className="dash-bar-fill" style={{ width: max ? `${(value / max) * 100}%` : "0%" }} />
    </div>
  );
}

function CharacterProgress({ row }) {
  const [open, setOpen] = useState(false);
  const done = row.total > 0 && row.ok === row.total;

  return (
    <div className="dash-card card">
      <button className="dash-card-header" onClick={() => setOpen((o) => !o)}>
        <span className="dash-character">{row.character.name}</span>
        <span className="dash-counts">
          <span className="badge ok">{row.ok} {STATUS_LABELS.ok}</span>
          {row.perime > 0 && <span className="badge perime">{row.perime} {STATUS_LABELS.perime}</span>}
          {row.manquant > 0 && (
            <span className="badge manquant">{row.manquant} {STATUS_LABELS.manquant}</span>
          )}
          {done && <span className="dash-done">🎉</span>}
        </span>
        <span className="dash-chevron">{open ? "▲" : "▼"}</span>
      </button>

      <ProgressBar value={row.ok} max={row.total} className="dash-card-bar" />

      {open && row.pending.length > 0 && (
        <ul className="dash-pending">
          {row.pending.map((l) => (
            <li key={l.id}>
              <span className={`badge ${l.status}`}>{STATUS_LABELS[l.status]}</span>
              <span className="dash-pending-loc">
                {l.act} · {l.scene}
              </span>
              <span className="dash-pending-text">{l.text}</span>
            </li>
          ))}
        </ul>
      )}
      {open && row.pending.length === 0 && (
        <p className="dash-all-done">Toutes les répliques sont enregistrées. 👏</p>
      )}
    </div>
  );
}
