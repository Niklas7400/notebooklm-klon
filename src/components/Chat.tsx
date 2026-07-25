"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Citation, Message } from "@/lib/types";

// Tolerant gegenueber leichten Format-Abweichungen des Modells (z.B. ohne
// eckige Klammern), siehe Hinweis zur Zitat-Zuverlaessigkeit in CLAUDE.md.
const CITATION_REGEX = /\[?chunk:\s*(\d+)\]?/gi;

function renderContent(
  content: string,
  citations: Citation[] | null,
  onCitationClick: (citation: Citation) => void
): ReactNode {
  if (!citations || citations.length === 0) return content;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(CITATION_REGEX);
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const localId = parseInt(match[1], 10);
    const citation = citations.find((c) => c.local_id === localId);
    if (citation) {
      parts.push(
        <button
          key={`c-${key++}`}
          type="button"
          onClick={() => onCitationClick(citation)}
          className="mx-0.5 rounded bg-neutral-300 px-1.5 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-400 dark:bg-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-500"
        >
          {localId}
        </button>
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  return parts;
}

export function Chat({
  notebookId,
  initialMessages,
  sourceIds,
  onCitationClick,
}: {
  notebookId: string;
  initialMessages: Message[];
  sourceIds: string[] | null;
  onCitationClick: (citation: Citation) => void;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || pending) return;

    setInput("");
    setError(null);
    setPending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `pending-user-${Date.now()}`,
        notebook_id: notebookId,
        role: "user",
        content: question,
        citations: null,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, question, sourceIds }),
      });
      const responseBody = await res.json();
      if (!res.ok) {
        setError(responseBody.error ?? "Fehler beim Senden der Frage.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          notebook_id: notebookId,
          role: "assistant",
          content: responseBody.answer,
          citations: responseBody.citations,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      setError("Netzwerkfehler beim Senden der Frage.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Stelle eine Frage zu den hochgeladenen Quellen.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((m) => (
              <li key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm ${
                    m.role === "user"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800"
                  }`}
                >
                  {renderContent(m.content, m.citations, onCitationClick)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Frage stellen…"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending ? "…" : "Senden"}
        </button>
      </form>
      {error && (
        <p className="border-t border-neutral-200 px-4 py-2 text-xs text-red-600 dark:border-neutral-800 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
