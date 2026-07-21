import React, { useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { characterHue } from "./CharacterPanel.jsx";

// One dialogue line: drag handle + character <select> + text + delete.
// Enter inside the textarea inserts a new line right after (like typing in a
// text file, but every "line" is a structured object with a stable id).
//
// React.memo + handlers built here from the stable `dispatch`/`addLine`
// props: rows whose `line` object kept its identity skip re-rendering, so a
// keystroke re-renders only the edited row's scene, not the whole play.
export default React.memo(function LineRow({
  line,
  characters,
  actIndex,
  sceneIndex,
  autoFocus,
  onFocusHandled,
  dispatch,
  addLine,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: line.id,
  });

  const textareaRef = useRef(null);

  // Auto-grow the textarea to fit its content.
  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(autoGrow, [line.text]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      onFocusHandled();
    }
  }, [autoFocus, onFocusHandled]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const known = characters.some((c) => c.id === line.characterId);

  return (
    <div ref={setNodeRef} style={style} className="line-row">
      <button
        className="drag-handle"
        title="Glisser pour déplacer"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      <span
        className="line-color"
        style={{
          background:
            line.characterId != null ? `hsl(${characterHue(line.characterId)}, 55%, 55%)` : "#ccc",
        }}
      />

      <select
        className="line-character"
        value={known ? line.characterId : ""}
        onChange={(e) =>
          dispatch({
            type: "SET_LINE_CHARACTER",
            actIndex,
            sceneIndex,
            lineId: line.id,
            characterId: e.target.value,
          })
        }
      >
        {!known && <option value="">— Personnage ? —</option>}
        {characters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <textarea
        ref={textareaRef}
        className="line-text"
        rows={1}
        placeholder="Texte de la réplique…"
        value={line.text}
        onChange={(e) =>
          dispatch({ type: "EDIT_TEXT", actIndex, sceneIndex, lineId: line.id, text: e.target.value })
        }
        onInput={autoGrow}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            addLine(actIndex, sceneIndex, line.id);
          }
        }}
      />

      <button
        className="btn icon small line-delete"
        title="Supprimer cette réplique"
        onClick={() => dispatch({ type: "DELETE_LINE", actIndex, sceneIndex, lineId: line.id })}
      >
        ✕
      </button>
    </div>
  );
});
