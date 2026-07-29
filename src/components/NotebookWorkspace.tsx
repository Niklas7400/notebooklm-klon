"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadForm } from "@/components/UploadForm";
import { Chat } from "@/components/Chat";
import { GenerateSidebar } from "@/components/GenerateSidebar";
import { Dialog } from "@/components/Dialog";
import type { Citation, Message, Notebook, Source } from "@/lib/types";

type SourceListItem = Pick<Source, "id" | "filename">;

type SourceKind = "pdf" | "url" | "text";

function getSourceKind(filename: string): SourceKind {
  if (/^https?:\/\//i.test(filename)) return "url";
  if (filename.toLowerCase().endsWith(".pdf")) return "pdf";
  return "text";
}

const SOURCE_ICON_PATHS: Record<SourceKind, string> = {
  pdf: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z",
  url: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1",
  text: "M4 6h16M4 12h16M4 18h10",
};

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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [chatResetKey, setChatResetKey] = useState(0);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(
    notebook.suggested_questions ?? []
  );
  const [title, setTitle] = useState(notebook.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(notebook.title);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [resetChatOpen, setResetChatOpen] = useState(false);
  const [deleteNotebookOpen, setDeleteNotebookOpen] = useState(false);

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
    setUploadOpen(false);
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
    const res = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
    if (res.ok) {
      setExcludedSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
      if (viewingSource) setViewingSource(null);
      router.refresh();
    }
  }

  async function handleViewSource(sourceId: string) {
    const res = await fetch(`/api/sources/${sourceId}`);
    if (res.ok) {
      setViewingSource(await res.json());
    }
  }

  async function confirmDeleteNotebook() {
    const res = await fetch(`/api/notebooks/${notebook.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
    } else {
      setDeleteNotebookOpen(false);
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Löschen fehlgeschlagen.");
    }
  }

  async function confirmResetChat() {
    const res = await fetch(`/api/notebooks/${notebook.id}/messages`, { method: "DELETE" });
    setResetChatOpen(false);
    if (res.ok) {
      setChatResetKey((k) => k + 1);
    }
  }

  const activeSourceIds =
    excludedSourceIds.size === 0
      ? null
      : sources.filter((s) => !excludedSourceIds.has(s.id)).map((s) => s.id);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <nav className="flex shrink-0 items-center gap-3 border-b border-divider px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[13px] text-neutral-400 no-underline hover:text-accent"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Notebooks
        </Link>
        <div className="h-[18px] w-px bg-divider" />

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
            className="input w-[280px] font-heading text-[15px]"
          />
        ) : (
          <button
            type="button"
            className="btn btn-ghost gap-2"
            style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)", fontSize: "15px" }}
            onClick={() => {
              setTitleDraft(title);
              setEditingTitle(true);
            }}
            title="Titel bearbeiten"
          >
            {title}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-neutral-500)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        )}

        {notebook.is_demo && <span className="tag tag-accent">Demo</span>}

        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setResetChatOpen(true)}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
            Chat zurücksetzen
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: "var(--color-danger)" }}
            disabled={notebook.is_demo}
            title={notebook.is_demo ? "Das Demo-Notebook kann nicht gelöscht werden." : undefined}
            onClick={() => setDeleteNotebookOpen(true)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16" />
              <path d="M10 11v6M14 11v6" />
              <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
            </svg>
            Löschen
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-1/4 shrink-0 flex-col gap-[22px] overflow-y-auto border-r border-divider p-5">
          <div>
            <h6 className="m-0 mb-2.5 text-neutral-400">Quellen · {sources.length}</h6>
            {sources.length === 0 ? (
              <p className="m-0 text-xs text-neutral-500">Noch keine Quelle hochgeladen.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sources.map((s) => {
                  const kind = getSourceKind(s.filename);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border border-divider px-2 py-1.5"
                    >
                      <input
                        type="checkbox"
                        checked={!excludedSourceIds.has(s.id)}
                        onChange={() => toggleSource(s.id)}
                        className="shrink-0 cursor-pointer accent-accent"
                        title="In die Suche einbeziehen"
                      />
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--color-neutral-500)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0"
                      >
                        <path d={SOURCE_ICON_PATHS[kind]} />
                      </svg>
                      <button
                        type="button"
                        onClick={() => handleViewSource(s.id)}
                        className="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[12.5px] text-text"
                        title={`${s.filename} — Volltext anzeigen`}
                      >
                        {s.filename}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSource(s.id)}
                        className="shrink-0 cursor-pointer border-0 bg-transparent p-0.5 text-neutral-600 hover:text-danger"
                        aria-label={`${s.filename} löschen`}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {viewingSource && (
              <div className="mt-2 rounded-md border border-divider bg-surface p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium" title={viewingSource.filename}>
                    {viewingSource.filename}
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewingSource(null)}
                    className="shrink-0 cursor-pointer border-0 bg-transparent text-neutral-500 hover:text-neutral-300"
                    aria-label="Schließen"
                  >
                    ✕
                  </button>
                </div>
                <p className="m-0 max-h-[32rem] overflow-y-auto text-xs leading-[1.6] whitespace-pre-wrap text-neutral-400">
                  {viewingSource.raw_text}
                </p>
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-block mt-2.5"
              onClick={() => setUploadOpen(true)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v12" />
                <path d="M6.5 9L12 3.5 17.5 9" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              Quelle hinzufügen
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
              selectedCitation={selectedCitation}
              onCitationClick={setSelectedCitation}
              onCloseCitation={() => setSelectedCitation(null)}
            />
          )}
        </main>

        <GenerateSidebar
          notebookId={notebook.id}
          hasSources={sources.length > 0}
          summary={summary}
          summarizing={summarizing}
          summaryOpen={summaryOpen}
          onToggleSummary={() => setSummaryOpen((open) => !open)}
          initialStudyGuide={notebook.study_guide}
          initialAudioScript={notebook.audio_script}
          initialAudioClipUrls={notebook.audio_clip_urls}
          initialAudioStatus={notebook.audio_status}
        />
      </div>

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} title="Quelle hinzufügen">
        <UploadForm
          notebookId={notebook.id}
          onUploaded={handleUploaded}
          onCancel={() => setUploadOpen(false)}
        />
      </Dialog>

      <Dialog
        open={resetChatOpen}
        onClose={() => setResetChatOpen(false)}
        title="Chatverlauf zurücksetzen?"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setResetChatOpen(false)}>
              Abbrechen
            </button>
            <button
              className="btn btn-secondary"
              style={{ color: "var(--color-danger)" }}
              onClick={confirmResetChat}
            >
              Zurücksetzen
            </button>
          </>
        }
      >
        Der bisherige Chatverlauf für dieses Notebook wird gelöscht.
      </Dialog>

      <Dialog
        open={deleteNotebookOpen}
        onClose={() => setDeleteNotebookOpen(false)}
        title="Notebook löschen?"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteNotebookOpen(false)}>
              Abbrechen
            </button>
            <button
              className="btn btn-secondary"
              style={{ color: "var(--color-danger)" }}
              onClick={confirmDeleteNotebook}
            >
              Löschen
            </button>
          </>
        }
      >
        „{title}“ wird unwiderruflich gelöscht, inklusive aller Quellen und des Chatverlaufs.
      </Dialog>
    </div>
  );
}
