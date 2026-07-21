import { useEffect, useRef, useState, useCallback } from "react";

// MediaRecorder output differs per browser (webm/opus on Chrome/Firefox,
// mp4/aac on Safari). We do NOT care: the GitHub Action transcodes everything
// to mp3 with ffmpeg. We only pick a supported container and a matching
// file extension for the ZIP.
const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return ""; // let the browser choose its default
}

export function extensionForMimeType(mimeType) {
  if (!mimeType) return "webm";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || mimeType.includes("aac")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

// One-shot in-memory recorder: start(lineId), then stop() resolves with the
// recorded Blob. A single line records at a time.
//
// The mic stream is reused across takes (so the browser asks permission
// once per session), but release() stops the tracks — call it when the
// recording session is over (ZIP downloaded, component unmounted) so the
// browser's mic-in-use indicator turns off.
export default function useRecorder() {
  const [recordingLineId, setRecordingLineId] = useState(null);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const release = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Stop capturing when the page unmounts.
  useEffect(() => release, [release]);

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const start = useCallback(async (lineId) => {
    setError(null);
    try {
      // Reuse the stream across takes so the browser asks permission once.
      if (!streamRef.current || !streamRef.current.active) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        streamRef.current,
        mimeType ? { mimeType } : undefined
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingLineId(lineId);
    } catch (err) {
      setError(
        "Impossible d'accéder au micro. Vérifiez que vous avez autorisé le micro pour ce site."
      );
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setRecordingLineId(null);
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "";
        const blob = new Blob(chunksRef.current, mimeType ? { type: mimeType } : undefined);
        setRecordingLineId(null);
        resolve({ blob, mimeType });
      };
      recorder.stop();
    });
  }, []);

  return { supported, recordingLineId, error, start, stop, release };
}
