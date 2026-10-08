"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function UploadForm({
  notebookId,
  onUploaded,
  onCancel,
}: {
  notebookId: string;
  onUploaded?: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"pdf" | "text" | "url">("pdf");
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
      onUploaded?.();
    } catch {
      setError("Upload fehlgeschlagen — Netzwerkfehler.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="seg">
        <label className="seg-opt">
          <input
            type="radio"
            name="mode"
            checked={mode === "pdf"}
            onChange={() => setMode("pdf")}
          />
          PDF
        </label>
        <label className="seg-opt">
          <input
            type="radio"
            name="mode"
            checked={mode === "text"}
            onChange={() => setMode("text")}
          />
          Text
        </label>
        <label className="seg-opt">
          <input
            type="radio"
            name="mode"
            checked={mode === "url"}
            onChange={() => setMode("url")}
          />
          URL
        </label>
      </div>

      {mode === "pdf" ? (
        <div className="field">
          <label>PDF-Datei</label>
          <input type="file" name="file" accept="application/pdf" required className="input" />
        </div>
      ) : mode === "text" ? (
        <>
          <div className="field">
            <label>Titel (optional)</label>
            <input type="text" name="filename" placeholder="Titel" className="input" />
          </div>
          <div className="field">
            <label>Text</label>
            <textarea
              name="text"
              required
              rows={4}
              placeholder="Text einfügen…"
              className="input"
            />
          </div>
        </>
      ) : (
        <div className="field">
          <label>URL</label>
          <input
            type="url"
            name="url"
            required
            placeholder="https://beispiel.de/artikel"
            className="input"
          />
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Wird hochgeladen…" : "Hochladen"}
        </button>
      </div>
    </form>
  );
}
