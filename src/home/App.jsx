import React, { useEffect, useState } from "react";
import { fetchManifest } from "../shared/data.js";
import "./home.css";

const PAGES = [
  {
    href: "./rehearsal.html",
    emoji: "🎭",
    title: "Répétition",
    who: "Pour toute la troupe",
    desc: "Répétez « à l'italienne » : la pièce se joue avec les vraies voix, vous dites vos répliques au bon moment.",
  },
  {
    href: "./recorder.html",
    emoji: "🎙️",
    title: "Enregistrement",
    who: "Pour les acteurs",
    desc: "Choisissez votre personnage, enregistrez vos répliques, puis envoyez le fichier à votre responsable.",
  },
  {
    href: "./dashboard.html",
    emoji: "📊",
    title: "Avancement",
    who: "Pour le responsable",
    desc: "Qui a enregistré quoi ? Quelles répliques restent à faire ou à refaire ?",
  },
  {
    href: "./editor.html",
    emoji: "✍️",
    title: "Éditeur",
    who: "Pour le responsable",
    desc: "Saisissez et corrigez le texte de la pièce : personnages, actes, scènes et répliques.",
  },
];

export default function App() {
  const [title, setTitle] = useState(null);

  useEffect(() => {
    fetchManifest()
      .then((m) => setTitle(m.title || null))
      .catch(() => {});
  }, []);

  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-brand">🎭 PrettyDrama</div>
        {title && <h1 className="home-play-title">{title}</h1>}
      </header>

      <main className="home-grid">
        {PAGES.map((p) => (
          <a key={p.href} className="home-card card" href={p.href}>
            <span className="home-card-emoji">{p.emoji}</span>
            <span className="home-card-title">{p.title}</span>
            <span className="home-card-who">{p.who}</span>
            <span className="home-card-desc">{p.desc}</span>
          </a>
        ))}
      </main>

      <footer className="home-footer">
        Un outil libre pour les troupes de théâtre —{" "}
        <a href="https://github.com/ThomasParistech/prettydrama-voices" target="_blank" rel="noreferrer">
          PrettyDrama
        </a>
      </footer>
    </div>
  );
}
