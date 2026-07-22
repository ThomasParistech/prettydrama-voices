import { useEffect, useRef, useCallback } from "react";

// Browser TTS fallback (SpeechSynthesis) for lines whose real clip is not
// (yet) available. v1 used offline TTS; this is new code.
//
// Contract: speak(text, onEnd) ALWAYS fires onEnd asynchronously, exactly
// once. When SpeechSynthesis is unavailable, a reading-paced timer stands in
// (~80 ms per character) — the caller's advance loop stays timed instead of
// recursing synchronously through the whole scene.
export default function useTts() {
  const voiceRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prefer a French voice; otherwise let the browser use its default.
      voiceRef.current =
        voices.find((v) => v.lang === "fr-FR") || voices.find((v) => v.lang.startsWith("fr")) || null;
    };
    pickVoice();
    // Chrome loads voices asynchronously.
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  // iOS/Safari mobile: speechSynthesis n'a le droit de parler que s'il a été
  // amorcé au moins une fois DANS un geste utilisateur. Sans ça, la 1re
  // réplique TTS déclenchée par un callback (fin d'un mp3, timer) échoue en
  // silence — ni onend ni onerror — et la lecture reste figée. À appeler
  // depuis le clic Lecture, comme la création de l'AudioContext.
  const unlock = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
    } catch {
      /* pas de synthèse dispo : le fallback minuté prend le relais */
    }
  }, []);

  // speak(text, onEnd): onEnd fires once, asynchronously, whether the
  // utterance ends, errors, or TTS is unsupported (timed fallback).
  const speak = useCallback(
    (text, onEnd) => {
      cancel();
      if (!("speechSynthesis" in window)) {
        // Silent reading-paced advance (text stays visible on screen).
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          onEnd();
        }, Math.max(2000, text.length * 80));
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      if (voiceRef.current) utterance.voice = voiceRef.current;
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          // setTimeout(0) so onEnd is asynchronous even if the browser fires
          // an error event synchronously from speak().
          setTimeout(onEnd, 0);
        }
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    },
    [cancel]
  );

  return { speak, cancel, unlock };
}
