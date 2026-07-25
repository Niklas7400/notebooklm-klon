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
          className="flex items-center gap-2 rounded-md border border-neutral-200 px-4 py-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          <Link href={`/notebook/${nb.id}`} className="min-w-0 flex-1">
            <span className="font-medium">{nb.title}</span>
            {nb.is_demo && (
              <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                Demo
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(nb)}
            disabled={nb.is_demo}
            title={nb.is_demo ? "Das Demo-Notebook kann nicht gelöscht werden." : "Notebook löschen"}
            className="shrink-0 rounded px-2 py-1 text-xs text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
