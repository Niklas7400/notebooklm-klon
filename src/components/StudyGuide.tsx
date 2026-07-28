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
  initialStudyGuide,
}: {
  notebookId: string;
  hasSources: boolean;
  initialStudyGuide: string | null;
}) {
  const [studyGuide, setStudyGuide] = useState<string | null>(initialStudyGuide);
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
        <div className="flex items-center gap-2 text-neutral-300">
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
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <h6 className="m-0 text-[13px] tracking-[0.08em] uppercase">Study Guide &amp; FAQ</h6>
        </div>
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
            <div className="max-h-[32rem] overflow-y-auto rounded-md border border-divider p-2.5">
              {renderMarkdownLite(studyGuide)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
