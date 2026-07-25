"use client";

import Link from "next/link";
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
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

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
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Quellen
          </h2>
          {sources.length === 0 ? (
            <p className="text-xs text-neutral-500">Noch keine Quelle hochgeladen.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="truncate rounded border border-neutral-200 px-2 py-1.5 text-xs dark:border-neutral-800"
                  title={s.filename}
                >
                  {s.filename}
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
            <p className="text-neutral-600 dark:text-neutral-400">
              {selectedCitation.snippet}
            </p>
          </div>
        )}

        <div className="mt-auto border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Quelle hinzufügen
          </h2>
          <UploadForm notebookId={notebook.id} />
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
            notebookId={notebook.id}
            initialMessages={initialMessages}
            onCitationClick={setSelectedCitation}
          />
        )}
      </main>
    </div>
  );
}
