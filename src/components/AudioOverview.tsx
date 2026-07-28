"use client";

import { useRef, useState } from "react";
import type { AudioScriptLine, AudioStatus } from "@/lib/types";

// Sequenzielle Wiedergabe der TTS-Clips -- kein serverseitiges
// Audio-Zusammenschneiden noetig, der naechste Clip startet automatisch
// ueber das onEnded-Event des <audio>-Elements (siehe CLAUDE.md).
function firstPlayableIndex(clipUrls: (string | null)[], from: number): number {
  for (let i = from; i < clipUrls.length; i++) {
    if (clipUrls[i]) return i;
  }
  return -1;
}

export function AudioOverview({
  notebookId,
  hasSources,
  initialScript,
  initialClipUrls,
  initialStatus,
}: {
  notebookId: string;
  hasSources: boolean;
  initialScript: AudioScriptLine[] | null;
  initialClipUrls: (string | null)[] | null;
  initialStatus: AudioStatus;
}) {
  const [script, setScript] = useState<AudioScriptLine[] | null>(initialScript);
  const [clipUrls, setClipUrls] = useState<(string | null)[] | null>(initialClipUrls);
  const [status, setStatus] = useState<AudioStatus>(initialStatus);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setIsPlaying(false);
    setCurrentIndex(-1);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/audio`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus("failed");
        setError(body?.error ?? "Audio Overview konnte nicht generiert werden.");
        return;
      }
      setScript(body.script);
      setClipUrls(body.clipUrls);
      setStatus(body.audioStatus);
      if (body.audioStatus === "failed") {
        setError("Kein einziger Audio-Clip konnte erzeugt werden.");
      }
    } catch {
      setStatus("failed");
      setError("Netzwerkfehler bei der Generierung.");
    } finally {
      setGenerating(false);
    }
  }

  function playFrom(index: number) {
    if (!audioRef.current || !clipUrls) return;
    const url = clipUrls[index];
    if (!url) return;
    setCurrentIndex(index);
    audioRef.current.src = url;
    audioRef.current.play();
    setIsPlaying(true);
  }

  function handlePlayPause() {
    if (!clipUrls) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    const startIndex = currentIndex >= 0 ? currentIndex : firstPlayableIndex(clipUrls, 0);
    if (startIndex === -1) return;
    playFrom(startIndex);
  }

  function handleEnded() {
    if (!clipUrls) return;
    const next = firstPlayableIndex(clipUrls, currentIndex + 1);
    if (next === -1) {
      setIsPlaying(false);
      setCurrentIndex(-1);
      return;
    }
    playFrom(next);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSectionOpen((o) => !o)}
          className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-neutral-300"
          aria-expanded={sectionOpen}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform ${sectionOpen ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 9a8 8 0 1 1 5.6 7.6" />
            <path d="M4 9v5h5" />
            <path d="M12 8v4l3 2" />
          </svg>
          <h6 className="m-0 text-[13px] tracking-[0.08em] uppercase">Audio Overview</h6>
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!hasSources || generating || status === "generating"}
          className="btn btn-ghost text-[11px]"
        >
          {generating
            ? "Wird generiert…"
            : status === "ready"
              ? "Neu generieren"
              : "Generieren"}
        </button>
      </div>

      {/* Immer gemountet (nur visuell versteckt), damit ein Einklappen der
          Sektion eine laufende Wiedergabe nicht unterbricht. */}
      <audio ref={audioRef} onEnded={handleEnded} className="hidden" />

      {sectionOpen && (
        <>
          {generating && (
            <p className="m-0 text-xs text-accent-300">
              <span className="inline-block animate-[pulse_1.4s_ease-in-out_infinite]">
                Podcast-Gespräch wird erstellt…
              </span>
            </p>
          )}
          {!generating && error && <p className="m-0 text-xs text-danger">{error}</p>}
          {!generating && !error && !hasSources && (
            <p className="m-0 text-xs text-neutral-500">Erst eine Quelle hochladen.</p>
          )}
          {!generating && !error && hasSources && status === "none" && (
            <p className="m-0 text-xs text-neutral-500">Noch kein Audio Overview generiert.</p>
          )}

          {script && clipUrls && status === "ready" && (
            <div className="mt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handlePlayPause}
                className="btn btn-primary self-start"
              >
                {isPlaying ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" />
                    <rect x="14" y="5" width="4" height="14" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
                {isPlaying ? "Pause" : "Abspielen"}
              </button>
              <div className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto">
                {script.map((line, i) => (
                  <div
                    key={i}
                    className={`rounded-sm px-2 py-1.5 text-xs ${
                      i === currentIndex ? "bg-accent-800" : "bg-transparent"
                    }`}
                  >
                    <span className="font-medium text-accent-300">
                      {line.speaker === "A" ? "Host A" : "Host B"}:{" "}
                    </span>
                    <span className="text-neutral-300">{line.text}</span>
                    {!clipUrls[i] && (
                      <span className="ml-1 text-neutral-500">(Audio nicht verfügbar)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
