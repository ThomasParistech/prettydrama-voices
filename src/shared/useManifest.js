import { useEffect, useState } from "react";
import { fetchManifest, MANIFEST_ERROR_MESSAGE } from "./data.js";

// Single manifest-loading hook shared by recorder, rehearsal and dashboard,
// so the loading/error behavior (and its French wording) cannot drift
// between pages.
export default function useManifest() {
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchManifest()
      .then((m) => !cancelled && setManifest(m))
      .catch(() => !cancelled && setError(MANIFEST_ERROR_MESSAGE));
    return () => {
      cancelled = true;
    };
  }, []);

  return { manifest, error };
}
