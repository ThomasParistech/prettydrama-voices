import React from "react";
import SceneEditor from "./SceneEditor.jsx";
import EditableTitle from "./EditableTitle.jsx";

// React.memo: EDIT_TEXT only changes the touched scene's identity, so every
// other act (and scene) skips re-rendering on each keystroke.
export default React.memo(function ActEditor({
  act,
  actIndex,
  actCount,
  characters,
  dispatch,
  addLine,
  focusLineId,
  onFocusHandled,
}) {
  return (
    <section className="act-block">
      <div className="act-header">
        <EditableTitle
          value={act.title}
          className="act-title"
          onChange={(title) => dispatch({ type: "RENAME_ACT", actIndex, title })}
        />
        {actCount > 1 && (
          <button
            className="btn icon small"
            title="Supprimer cet acte"
            onClick={() => {
              const lineCount = act.scenes.reduce((n, s) => n + s.lines.length, 0);
              if (
                lineCount === 0 ||
                window.confirm(
                  `Supprimer « ${act.title} » et ses ${lineCount} réplique(s) ? Cette action est définitive.`
                )
              ) {
                dispatch({ type: "DELETE_ACT", actIndex });
              }
            }}
          >
            ✕
          </button>
        )}
      </div>

      {act.scenes.map((scene, sceneIndex) => (
        <SceneEditor
          key={sceneIndex}
          scene={scene}
          actIndex={actIndex}
          sceneIndex={sceneIndex}
          sceneCount={act.scenes.length}
          characters={characters}
          dispatch={dispatch}
          addLine={addLine}
          focusLineId={focusLineId}
          onFocusHandled={onFocusHandled}
        />
      ))}

      <button className="btn small add-scene-btn" onClick={() => dispatch({ type: "ADD_SCENE", actIndex })}>
        + Ajouter une scène
      </button>
    </section>
  );
});
