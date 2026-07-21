import React, { useState } from "react";

// Click-to-edit title (acts and scenes).
export default function EditableTitle({ value, onChange, className }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) onChange(draft.trim());
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        type="text"
        className={`${className || ""} title-input`}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <button
      className={`${className || ""} title-display`}
      title="Cliquer pour renommer"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
    </button>
  );
}
