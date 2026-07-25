"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function UploadForm({ notebookId }: { notebookId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("notebookId", notebookId);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Upload fehlgeschlagen.");
        return;
      }
      formRef.current?.reset();
      router.refresh();
    } catch {
      setError("Upload fehlgeschlagen — Netzwerkfehler.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => setMode("pdf")}
          className={`rounded px-2 py-1 ${mode === "pdf" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-neutral-100 dark:bg-neutral-800"}`}
        >
          PDF
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`rounded px-2 py-1 ${mode === "text" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-neutral-100 dark:bg-neutral-800"}`}
        >
          Text
        </button>
      </div>

      {mode === "pdf" ? (
        <input
          type="file"
          name="file"
          accept="application/pdf"
          required
          className="text-xs"
        />
      ) : (
        <>
          <input
            type="text"
            name="filename"
            placeholder="Titel (optional)"
            className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
          />
          <textarea
            name="text"
            required
            rows={4}
            placeholder="Text einfügen…"
            className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
          />
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Wird hochgeladen…" : "Hochladen"}
      </button>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
