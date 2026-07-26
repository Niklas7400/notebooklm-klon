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
    <button onClick={handleClick} disabled={pending} className="btn btn-primary">
      {pending ? "Wird angelegt…" : "+ Neues Notebook"}
    </button>
  );
}
