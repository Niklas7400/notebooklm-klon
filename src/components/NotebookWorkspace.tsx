"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadForm } from "@/components/UploadForm";
import { Chat } from "@/components/Chat";
import type { Citation, Message, Notebook, Source } from "@/lib/types";

type SourceListItem = Pick<Source, "id" | "filename">;

export function NotebookWorkspace({
  notebook,
  sources,
  initialMessages,
}: {
  notebook: Notebook;
  sources: SourceListItem[];
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [excludedSourceIds, setExcludedSourceIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState(notebook.summary);
  const [summarizing, setSummarizing] = useState(false);
  const [chatResetKey, setChatResetKey] = useState(0);

  function toggleSource(id: string) {
    setExcludedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleUploaded() {
    setSummarizing(true);
    try {
      const res = await fetch(`/api/notebooks/${notebook.id}/summary`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } finally {
      setSummarizing(false);
    }
  }

  async function handleDeleteSource(sourceId: string) {
    if (!confirm("Diese Quelle wirklich löschen?")) return;
    const res = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
    if (res.ok) {
      setExcludedSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
      router.refresh();
    }
  }

  async function handleDeleteNotebook() {
    if (
      !confirm(
        `Notebook "${notebook.title}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`
      )
    )
      return;
    const res = await fetch(`/api/notebooks/${notebook.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Löschen fehlgeschlagen.");
    }
  }

  async function handleResetChat() {
    if (!confirm("Chatverlauf für dieses Notebook wirklich zurücksetzen?")) return;
    const res = await fetch(`/api/notebooks/${notebook.id}/messages`, { method: "DELETE" });
    if (res.ok) {
      setChatResetKey((k) => k + 1);
    }
  }

  const activeSourceIds =
    excludedSourceIds.size === 0
      ? null
      : sources.filter((s) => !excludedSourceIds.has(s.id)).map((s) => s.id);

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <Link href="/" className="text-xs text-neutral-500 hover:underline">
            ← Notebooks
          </Link>
          <h1 className="mt-1 truncate text-lg font-semibold">{notebook.title}</h1>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Zusammenfassung
            </h2>
            {summarizing && (
              <span className="text-[10px] text-neutral-400">wird aktualisiert…</span>
            )}
          </div>
          {summary ? (
            <p className="whitespace-pre-wrap text-xs text-neutral-600 dark:text-neutral-400">
              {summary}
            </p>
          ) : (
            <p className="text-xs text-neutral-500">
              {summarizing ? "Wird erstellt…" : "Noch keine Zusammenfassung."}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Quellen
            </h2>
            {sources.length > 0 && (
              <button
                type="button"
                onClick={handleResetChat}
                className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
              >
                Chat zurücksetzen
              </button>
            )}
          </div>
          {sources.length === 0 ? (
            <p className="text-xs text-neutral-500">Noch keine Quelle hochgeladen.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 rounded border border-neutral-200 px-2 py-1.5 text-xs dark:border-neutral-800"
                >
                  <input
                    type="checkbox"
                    checked={!excludedSourceIds.has(s.id)}
                    onChange={() => toggleSource(s.id)}
                    title="Diese Quelle in die Suche einbeziehen"
                  />
                  <span className="min-w-0 flex-1 truncate" title={s.filename}>
                    {s.filename}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteSource(s.id)}
                    className="shrink-0 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                    aria-label={`${s.filename} löschen`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedCitation && (
          <div className="rounded border border-neutral-200 p-3 text-xs dark:border-neutral-800">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate font-medium" title={selectedCitation.filename}>
                {selectedCitation.filename}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                className="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">
              {selectedCitation.snippet}
            </p>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Quelle hinzufügen
            </h2>
            <UploadForm notebookId={notebook.id} onUploaded={handleUploaded} />
          </div>

          <button
            type="button"
            onClick={handleDeleteNotebook}
            disabled={notebook.is_demo}
            title={notebook.is_demo ? "Das Demo-Notebook kann nicht gelöscht werden." : undefined}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Notebook löschen
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        {sources.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-neutral-500">
              Lade zuerst eine Quelle hoch, um Fragen stellen zu können.
            </p>
          </div>
        ) : (
          <Chat
            key={chatResetKey}
            notebookId={notebook.id}
            initialMessages={chatResetKey === 0 ? initialMessages : []}
            sourceIds={activeSourceIds}
            onCitationClick={setSelectedCitation}
          />
        )}
      </main>
    </div>
  );
}
