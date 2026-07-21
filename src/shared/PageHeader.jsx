import React from "react";

// Common top bar: brand link back to home + page title + free slot on the right.
export default function PageHeader({ title, children }) {
  return (
    <header className="page-header">
      <a className="brand" href="./index.html">
        🎭 PrettyDrama
      </a>
      <span className="page-title">{title}</span>
      <span className="spacer" />
      {children}
    </header>
  );
}
