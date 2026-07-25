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
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Audio Overview
        </h2>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!hasSources || generating || status === "generating"}
          className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
        >
          {generating
            ? "Wird generiert…"
            : status === "ready"
              ? "Neu generieren"
              : "Generieren"}
        </button>
      </div>

      {generating && (
        <p className="text-xs text-neutral-500">
          Podcast-Gespräch wird erstellt — kann bis zu einer Minute dauern…
        </p>
      )}
      {!generating && error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {!generating && !error && !hasSources && (
        <p className="text-xs text-neutral-500">Erst eine Quelle hochladen.</p>
      )}
      {!generating && !error && hasSources && status === "none" && (
        <p className="text-xs text-neutral-500">
          Noch kein Audio Overview generiert.
        </p>
      )}

      {script && clipUrls && status === "ready" && (
        <div className="mt-2 flex flex-col gap-2">
          <audio ref={audioRef} onEnded={handleEnded} className="hidden" />
          <button
            type="button"
            onClick={handlePlayPause}
            className="self-start rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {isPlaying ? "⏸ Pause" : "▶ Abspielen"}
          </button>
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-xs">
            {script.map((line, i) => (
              <li
                key={i}
                className={`rounded px-2 py-1 ${
                  i === currentIndex
                    ? "bg-neutral-200 dark:bg-neutral-700"
                    : "bg-neutral-50 dark:bg-neutral-900"
                }`}
              >
                <span className="font-medium">
                  {line.speaker === "A" ? "Host A" : "Host B"}:
                </span>{" "}
                {line.text}
                {!clipUrls[i] && (
                  <span className="ml-1 text-neutral-400">(Audio nicht verfügbar)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
