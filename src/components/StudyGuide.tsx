"use client";

import { useState, type ReactNode } from "react";

// Sehr schlanker Markdown-Renderer (nur "## Ueberschrift" und "**fett**") --
// fuer den Umfang dieses Features reicht das, statt eine Markdown-Bibliothek
// als Abhaengigkeit hinzuzufuegen.
function renderMarkdownLite(text: string): ReactNode[] {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return (
        <h6
          key={i}
          className="mt-2.5 mb-1 text-neutral-500 first:mt-0"
        >
          {line.slice(3)}
        </h6>
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
      <p key={i} className="m-0 mb-1.5 text-[12.5px] leading-[1.55] text-neutral-300">
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
        <h6 className="m-0 text-[11px] tracking-[0.08em] text-neutral-400 uppercase">
          Study Guide &amp; FAQ
        </h6>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!hasSources || loading}
          className="btn btn-ghost text-[11px]"
        >
          {loading ? "Wird generiert…" : studyGuide ? "Neu generieren" : "Generieren"}
        </button>
      </div>

      {!hasSources && <p className="m-0 text-xs text-neutral-500">Erst eine Quelle hochladen.</p>}
      {error && <p className="m-0 text-xs text-danger">{error}</p>}

      {studyGuide && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mb-1 cursor-pointer border-0 bg-transparent p-0 text-[11px] text-neutral-500 hover:text-neutral-300"
          >
            {open ? "Einklappen" : "Anzeigen"}
          </button>
          {open && (
            <div className="max-h-56 overflow-y-auto rounded-md border border-divider p-2.5">
              {renderMarkdownLite(studyGuide)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
