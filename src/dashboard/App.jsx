import React from "react";
import PageHeader from "../shared/PageHeader.jsx";
import PageState from "../shared/PageState.jsx";
import useManifest from "../shared/useManifest.js";
import "./dashboard.css";

// Pure read of data/manifest.json: recording progress per character, so the
// respo knows who to chase.
export default function App() {
  const { manifest, error: loadError } = useManifest();
  if (loadError) {
    return <PageState title="Avancement" error={loadError} />;
  }
  if (!manifest) {
    return <PageState title="Avancement" />;
  }
  return <Dashboard manifest={manifest} />;
}

// "Scène 3" -> "3" (compact column header); falls back to position.
function sceneNumber(title, index) {
  const match = /(\d+)\s*$/.exec(title || "");
  return match ? match[1] : String(index + 1);
}

function remainingCount(lines) {
  return lines.filter((l) => l.status !== "ok").length;
}

function Dashboard({ manifest }) {
  // Flat list of scene columns, keeping the act grouping for the header row.
  const scenes = manifest.acts.flatMap((act, actIndex) =>
    act.scenes.map((scene, sceneIndex) => ({
      key: `${actIndex}-${sceneIndex}`,
      act: act.title,
      label: sceneNumber(scene.title, sceneIndex),
      title: scene.title,
      lines: scene.lines,
      remaining: remainingCount(scene.lines),
    }))
  );

  const rows = manifest.characters.map((c) => {
    const cells = scenes.map((scene) => {
      const lines = scene.lines.filter((l) => l.characterId === c.id);
      return { total: lines.length, remaining: remainingCount(lines) };
    });
    return {
      character: c,
      cells,
      total: cells.reduce((sum, cell) => sum + cell.total, 0),
      remaining: cells.reduce((sum, cell) => sum + cell.remaining, 0),
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
      <PageHeader title="Avancement" />
      <div className="container">
        <h1 className="dash-title">{manifest.title || "Pièce sans titre"}</h1>
        <p className="dash-global">
          {totalOk} / {totalLines} répliques enregistrées
        </p>

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

        {rows.length === 0 || scenes.length === 0 ? (
          <div className="empty-state">
            Aucun personnage pour l'instant — la pièce doit d'abord être saisie dans l'éditeur.
          </div>
        ) : (
          <ProgressTable acts={manifest.acts} scenes={scenes} rows={rows} />
        )}

        <p className="dash-legend">
          Chaque cellule indique le nombre de répliques restant à enregistrer
          (✓ = tout est enregistré, · = pas de réplique dans la scène).
        </p>
      </div>
    </>
  );
}

// Characters × scenes grid: remaining lines to record in each cell, scene
// columns grouped by act, names tinted "done" / "still work to do".
function ProgressTable({ acts, scenes, rows }) {
  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th className="dash-corner" />
            {acts.map(
              (act, i) =>
                act.scenes.length > 0 && (
                  <th key={i} className="dash-act" colSpan={act.scenes.length}>
                    {act.title}
                  </th>
                )
            )}
          </tr>
          <tr>
            <th className="dash-corner" />
            {scenes.map((scene) => (
              <th
                key={scene.key}
                title={`${scene.act} · ${scene.title}`}
                className={`dash-scene ${scene.remaining > 0 ? "todo" : "done"}`}
              >
                {scene.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.character.id}>
              <th
                className={`dash-name ${
                  row.total === 0 ? "empty" : row.remaining > 0 ? "todo" : "done"
                }`}
              >
                {row.character.name}
              </th>
              {row.cells.map((cell, i) => (
                <td
                  key={scenes[i].key}
                  className={
                    cell.total === 0 ? "empty" : cell.remaining > 0 ? "todo" : "done"
                  }
                >
                  {cell.total === 0 ? "·" : cell.remaining > 0 ? cell.remaining : "✓"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
