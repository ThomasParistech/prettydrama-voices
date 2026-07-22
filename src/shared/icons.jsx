import React from "react";

// Icônes de contrôle en SVG (jamais des emojis : sur mobile ▶/⏸/⏹/⬇ rendaient
// en emoji bleu, hors palette). Toutes héritent la couleur du bouton via
// `currentColor` et se dimensionnent sur la font-size (1em) sauf override CSS.
const svg = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  "aria-hidden": true,
  focusable: false,
};

export function PlayIcon() {
  return (
    <svg {...svg} fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg {...svg} fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg {...svg} fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function PrevIcon() {
  return (
    <svg {...svg} fill="currentColor">
      <path d="M15 5v14L6 12z" />
    </svg>
  );
}

export function NextIcon() {
  return (
    <svg {...svg} fill="currentColor">
      <path d="M9 5v14l9-7z" />
    </svg>
  );
}

export function SkipPrevIcon() {
  return (
    <svg {...svg} fill="currentColor">
      <rect x="5" y="5" width="2.6" height="14" rx="1" />
      <path d="M20 5v14l-9-7z" />
    </svg>
  );
}

export function SkipNextIcon() {
  return (
    <svg {...svg} fill="currentColor">
      <path d="M4 5v14l9-7z" />
      <rect x="16.4" y="5" width="2.6" height="14" rx="1" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg
      {...svg}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4v10" />
      <path d="M8 10l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}
