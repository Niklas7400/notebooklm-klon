"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/Dialog";

export type NotebookCard = {
  id: string;
  title: string;
  isDemo: boolean;
  excerpt: string;
  sourceCount: number;
  relDate: string;
};

export function NotebooksHome({ initialNotebooks }: { initialNotebooks: NotebookCard[] }) {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState(initialNotebooks);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NotebookCard | null>(null);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? notebooks.filter((nb) => nb.title.toLowerCase().includes(query))
    : notebooks;

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Notebook konnte nicht angelegt werden.");
      const notebook = await res.json();
      router.push(`/notebook/${notebook.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/notebooks/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      setNotebooks((prev) => prev.filter((nb) => nb.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      setDeleteTarget(null);
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <nav className="flex items-center gap-3 border-b border-divider px-4 py-3">
        <span className="mr-auto flex items-center gap-2.5 font-heading text-lg font-medium">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="1" y="1" width="20" height="20" rx="6" stroke="var(--color-accent)" strokeWidth="1.5" />
            <rect x="8" y="8" width="9" height="9" rx="3" fill="var(--color-accent)" />
          </svg>
          Klarnote
        </span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setNewTitle("");
            setNewOpen(true);
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Neues Notebook
        </button>
      </nav>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-8 py-16">
        <div className="mb-11 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1>Notebooks</h1>
            <p className="m-0 text-sm text-neutral-500">{notebooks.length} Notebooks</p>
          </div>
          <div className="field w-[280px]">
            <div className="relative">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-neutral-500)"
                strokeWidth="2"
                strokeLinecap="round"
                className="pointer-events-none absolute top-1/2 left-[11px] -translate-y-1/2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Notebooks durchsuchen…"
                className="input pl-8"
              />
            </div>
          </div>
        </div>

        {notebooks.length === 0 ? (
          <div className="flex max-w-[480px] flex-col items-start gap-3.5 rounded-lg border border-divider p-14">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
            </svg>
            <h3 className="m-0">Noch kein Notebook vorhanden</h3>
            <p className="card-body m-0 opacity-70">
              Lege ein Notebook an, um Quellen hochzuladen und Fragen dazu zu stellen.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Neues Notebook
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-neutral-500">Keine Notebooks gefunden für „{search}“.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-[22px]">
            {filtered.map((nb) => (
              <div
                key={nb.id}
                onClick={() => router.push(`/notebook/${nb.id}`)}
                className="card elev-sm relative cursor-pointer transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="card-kicker">{nb.isDemo ? "Demo" : "Notebook"}</span>
                  {nb.isDemo && <span className="tag tag-accent">Demo</span>}
                </div>
                <h3 className="card-title">{nb.title}</h3>
                <p className="card-body">{nb.excerpt}</p>
                <div className="card-meta">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5" />
                  </svg>
                  <span>
                    {nb.sourceCount} {nb.sourceCount === 1 ? "Quelle" : "Quellen"}
                  </span>
                  <span>·</span>
                  <span>{nb.relDate}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-icon btn-ghost absolute top-2.5 right-2.5 text-neutral-400 opacity-55 hover:bg-danger/12 hover:text-danger hover:opacity-100"
                  aria-label="Notebook löschen"
                  title="Notebook löschen"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(nb);
                  }}
                >
                  <svg
                    width="15"
                    height="15"
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
                    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="Neues Notebook">
        <div className="field m-0">
          <label>Titel</label>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="z. B. Recherche Wettbewerbsanalyse"
            className="input"
          />
        </div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={() => setNewOpen(false)}>
            Abbrechen
          </button>
          <button className="btn btn-primary" disabled={creating} onClick={handleCreate}>
            {creating ? "Wird angelegt…" : "Erstellen"}
          </button>
        </div>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Notebook löschen?"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
              Abbrechen
            </button>
            <button
              className="btn btn-secondary"
              style={{ color: "var(--color-danger)", borderColor: "var(--color-danger)" }}
              onClick={confirmDelete}
            >
              Löschen
            </button>
          </>
        }
      >
        „{deleteTarget?.title}“ wird unwiderruflich gelöscht, inklusive aller Quellen und des
        Chatverlaufs.
      </Dialog>
    </div>
  );
}
