import React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import EditableTitle from "./EditableTitle.jsx";
import LineRow from "./LineRow.jsx";

// React.memo: only the scene being edited changes identity per keystroke.
export default React.memo(function SceneEditor({
  scene,
  actIndex,
  sceneIndex,
  sceneCount,
  characters,
  dispatch,
  addLine,
  focusLineId,
  onFocusHandled,
}) {
  const sensors = useSensors(
    // Small activation distance so simple clicks in the row don't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      dispatch({ type: "MOVE_LINE", actIndex, sceneIndex, activeId: active.id, overId: over.id });
    }
  };

  const canAddLines = characters.length > 0;

  return (
    <div className="scene-block card">
      <div className="scene-header">
        <EditableTitle
          value={scene.title}
          className="scene-title"
          onChange={(title) => dispatch({ type: "RENAME_SCENE", actIndex, sceneIndex, title })}
        />
        <span className="scene-line-count">
          {scene.lines.length} réplique{scene.lines.length > 1 ? "s" : ""}
        </span>
        {sceneCount > 1 && (
          <button
            className="btn icon small"
            title="Supprimer cette scène"
            onClick={() => {
              if (
                scene.lines.length === 0 ||
                window.confirm(
                  `Supprimer « ${scene.title} » et ses ${scene.lines.length} réplique(s) ? Cette action est définitive.`
                )
              ) {
                dispatch({ type: "DELETE_SCENE", actIndex, sceneIndex });
              }
            }}
          >
            ✕
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={scene.lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="line-list">
            {scene.lines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                characters={characters}
                actIndex={actIndex}
                sceneIndex={sceneIndex}
                autoFocus={focusLineId === line.id}
                onFocusHandled={onFocusHandled}
                dispatch={dispatch}
                addLine={addLine}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {scene.lines.length === 0 && canAddLines && (
        <p className="scene-empty-hint">Aucune réplique — cliquez ci-dessous pour commencer.</p>
      )}
      {!canAddLines && (
        <p className="scene-empty-hint">
          Ajoutez d'abord un personnage dans le panneau de gauche pour pouvoir saisir des répliques.
        </p>
      )}

      <button
        className="btn small add-line-btn"
        disabled={!canAddLines}
        onClick={() => addLine(actIndex, sceneIndex, null)}
      >
        + Réplique
      </button>
    </div>
  );
});
