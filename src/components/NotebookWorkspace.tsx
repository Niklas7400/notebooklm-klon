"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadForm } from "@/components/UploadForm";
import { Chat } from "@/components/Chat";
import { AudioOverview } from "@/components/AudioOverview";
import { StudyGuide } from "@/components/StudyGuide";
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
  const [viewingSource, setViewingSource] = useState<{
    filename: string;
    raw_text: string;
  } | null>(null);
  const [excludedSourceIds, setExcludedSourceIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState(notebook.summary);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [chatResetKey, setChatResetKey] = useState(0);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [title, setTitle] = useState(notebook.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(notebook.title);

  async function handleRenameSubmit() {
    const nextTitle = titleDraft.trim();
    setEditingTitle(false);
    if (!nextTitle || nextTitle === title) {
      setTitleDraft(title);
      return;
    }
    const res = await fetch(`/api/notebooks/${notebook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle }),
    });
    if (res.ok) {
      setTitle(nextTitle);
      router.refresh();
    } else {
      setTitleDraft(title);
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Umbenennen fehlgeschlagen.");
    }
  }

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

    // Vorgeschlagene Einstiegsfragen nach jedem Upload neu erzeugen, damit
    // sie zu den aktuell vorhandenen Quellen passen (unabhaengig von der
    // Zusammenfassung, kein Grund den Chat-Aufbau darauf warten zu lassen).
    const questionsRes = await fetch(`/api/notebooks/${notebook.id}/suggested-questions`, {
      method: "POST",
    });
    if (questionsRes.ok) {
      const data = await questionsRes.json();
      setSuggestedQuestions(data.questions);
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

  async function handleViewSource(sourceId: string) {
    const res = await fetch(`/api/sources/${sourceId}`);
    if (res.ok) {
      setViewingSource(await res.json());
    }
  }

  async function handleDeleteNotebook() {
    if (
      !confirm(
        `Notebook "${title}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`
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
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setTitleDraft(title);
                  setEditingTitle(false);
                }
              }}
              className="mt-1 w-full rounded border border-neutral-300 px-1 py-0.5 text-lg font-semibold dark:border-neutral-700 dark:bg-neutral-900"
            />
          ) : (
            <div
              className="group mt-1 flex min-w-0 cursor-text items-center gap-1.5"
              title="Klicken zum Umbenennen"
              onClick={() => {
                setTitleDraft(title);
                setEditingTitle(true);
              }}
            >
              <h1 className="truncate text-lg font-semibold">{title}</h1>
              <span className="shrink-0 text-sm text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100">
                ✎
              </span>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSummaryOpen((open) => !open)}
              className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              aria-expanded={summaryOpen}
            >
              <span className={`inline-block transition-transform ${summaryOpen ? "rotate-90" : ""}`}>
                ▶
              </span>
              Zusammenfassung
            </button>
            {summarizing && (
              <span className="text-[10px] text-neutral-400">wird aktualisiert…</span>
            )}
          </div>
          {summaryOpen &&
            (summary ? (
              <p className="whitespace-pre-wrap text-xs text-neutral-600 dark:text-neutral-400">
                {summary}
              </p>
            ) : (
              <p className="text-xs text-neutral-500">
                {summarizing ? "Wird erstellt…" : "Noch keine Zusammenfassung."}
              </p>
            ))}
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
                  <button
                    type="button"
                    onClick={() => handleViewSource(s.id)}
                    className="min-w-0 flex-1 truncate text-left hover:underline"
                    title={`${s.filename} — Volltext anzeigen`}
                  >
                    {s.filename}
                  </button>
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

        <StudyGuide notebookId={notebook.id} hasSources={sources.length > 0} />

        <AudioOverview
          notebookId={notebook.id}
          hasSources={sources.length > 0}
          initialScript={notebook.audio_script}
          initialClipUrls={notebook.audio_clip_urls}
          initialStatus={notebook.audio_status}
        />

        {viewingSource && (
          <div className="rounded border border-neutral-200 p-3 text-xs dark:border-neutral-800">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate font-medium" title={viewingSource.filename}>
                {viewingSource.filename}
              </span>
              <button
                type="button"
                onClick={() => setViewingSource(null)}
                className="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">
              {viewingSource.raw_text}
            </p>
          </div>
        )}

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
            suggestedQuestions={suggestedQuestions}
            onCitationClick={setSelectedCitation}
          />
        )}
      </main>
    </div>
  );
}
