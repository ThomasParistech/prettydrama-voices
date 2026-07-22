import { useEffect } from "react";

// Garde la carte `.dialogue-card.active` de la liste centrée à l'écran quand
// la sélection change (partagé par les pages Répétition et Enregistrement).
// `deps` : les indices dont le changement doit déclencher le recentrage.
export default function useScrollToActiveCard(listRef, deps) {
  useEffect(() => {
    const card = listRef.current?.querySelector(".dialogue-card.active");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
