"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Notebook } from "@/lib/types";

export function NotebookList({ notebooks }: { notebooks: Notebook[] }) {
  const router = useRouter();

  async function handleDelete(notebook: Notebook) {
    if (
      !confirm(
        `Notebook "${notebook.title}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`
      )
    )
      return;

    const res = await fetch(`/api/notebooks/${notebook.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Löschen fehlgeschlagen.");
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {notebooks.map((nb) => (
        <li
          key={nb.id}
          className="flex items-center gap-2 rounded-md border border-divider px-4 py-3 hover:bg-surface"
        >
          <Link href={`/notebook/${nb.id}`} className="min-w-0 flex-1 text-text no-underline">
            <span className="font-medium">{nb.title}</span>
            {nb.is_demo && <span className="tag tag-accent ml-2">Demo</span>}
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(nb)}
            disabled={nb.is_demo}
            title={nb.is_demo ? "Das Demo-Notebook kann nicht gelöscht werden." : "Notebook löschen"}
            className="shrink-0 cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-xs text-neutral-500 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-neutral-500"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
