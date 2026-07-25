"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateNotebookButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Neues Notebook" }),
      });
      if (!res.ok) throw new Error("Notebook konnte nicht angelegt werden.");
      const notebook = await res.json();
      router.push(`/notebook/${notebook.id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
    >
      {pending ? "Wird angelegt…" : "+ Neues Notebook"}
    </button>
  );
}
