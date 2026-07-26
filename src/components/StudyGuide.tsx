"use client";

import { useState, type ReactNode } from "react";

// Sehr schlanker Markdown-Renderer (nur "## Ueberschrift" und "**fett**") --
// fuer den Umfang dieses Features reicht das, statt eine Markdown-Bibliothek
// als Abhaengigkeit hinzuzufuegen.
function renderMarkdownLite(text: string): ReactNode[] {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return (
        <h3
          key={i}
          className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 first:mt-0"
        >
          {line.slice(3)}
        </h3>
      );
    }
    if (!line.trim()) return <div key={i} className="h-1" />;

    const parts = line
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part, j) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={j}>{part.slice(2, -2)}</strong>
        ) : (
          part
        )
      );
    return (
      <p key={i} className="text-xs text-neutral-600 dark:text-neutral-400">
        {parts}
      </p>
    );
  });
}

export function StudyGuide({
  notebookId,
  hasSources,
}: {
  notebookId: string;
  hasSources: boolean;
}) {
  const [studyGuide, setStudyGuide] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/study-guide`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Study Guide konnte nicht generiert werden.");
        return;
      }
      setStudyGuide(body.studyGuide);
      setOpen(true);
    } catch {
      setError("Netzwerkfehler bei der Generierung.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Study Guide &amp; FAQ
        </h2>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!hasSources || loading}
          className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
        >
          {loading ? "Wird generiert…" : studyGuide ? "Neu generieren" : "Generieren"}
        </button>
      </div>

      {!hasSources && <p className="text-xs text-neutral-500">Erst eine Quelle hochladen.</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {studyGuide && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mb-1 text-[10px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            {open ? "Einklappen" : "Anzeigen"}
          </button>
          {open && (
            <div className="max-h-64 overflow-y-auto rounded border border-neutral-200 p-2 dark:border-neutral-800">
              {renderMarkdownLite(studyGuide)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
