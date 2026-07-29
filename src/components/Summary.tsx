"use client";

// Reine Anzeige-Komponente: die eigentliche Zusammenfassung wird automatisch
// nach jedem Upload in NotebookWorkspace neu angefordert (siehe
// handleUploaded dort) -- anders als Study Guide/Audio Overview gibt es hier
// keinen eigenen "Generieren"-Button und keinen eigenen Fetch-State.
export function Summary({
  summary,
  summarizing,
  open,
  onToggle,
}: {
  summary: string | null;
  summarizing: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-neutral-300"
        aria-expanded={open}
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
          className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
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
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h10" />
        </svg>
        <h6 className="m-0 text-[13px] tracking-[0.08em] uppercase">Zusammenfassung</h6>
      </button>

      {summarizing && <p className="mt-1 mb-0 text-[10px] text-neutral-500">wird aktualisiert…</p>}

      {open &&
        (summary ? (
          <p className="mt-2.5 mb-0 text-[13px] leading-[1.6] text-neutral-300">{summary}</p>
        ) : (
          <p className="mt-2.5 mb-0 text-xs text-neutral-500">
            {summarizing ? "Wird erstellt…" : "Noch keine Zusammenfassung."}
          </p>
        ))}
    </div>
  );
}
