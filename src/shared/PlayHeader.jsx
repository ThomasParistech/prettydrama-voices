import React, { useState } from "react";

// Collapsible sticky header shared by the rehearsal, recording and editor
// pages: brand and play title on one row (plus optional action buttons on the
// right); a settings area (children) folded/unfolded by clicking the title.
// (No mode label: it crowded the bar on mobile and was redundant with the
// page itself.)
export default function PlayHeader({ title, actions, children }) {
  const [open, setOpen] = useState(true);

  return (
    <header className={`play-header ${open ? "open" : ""}`}>
      <div className="play-header-row">
        <a className="header-brand" href="./index.html">
          🎭 PrettyDrama
        </a>
        <button
          className="play-header-toggle"
          title="Afficher ou masquer les réglages"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="play-header-title">{title}</span>
          <span className="play-header-chevron">{open ? "▲" : "▼"}</span>
        </button>
        {actions}
      </div>
      {open && <div className="play-header-settings">{children}</div>}
    </header>
  );
}
