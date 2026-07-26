"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Citation, Message } from "@/lib/types";
import { splitContentByCitations } from "@/lib/citations";

function renderContent(
  content: string,
  citations: Citation[] | null,
  onCitationClick: (citation: Citation) => void
): ReactNode {
  if (!citations || citations.length === 0) return content;

  let key = 0;
  return splitContentByCitations(content).map((segment) => {
    if (segment.type === "text") return segment.value;

    const citation = citations.find((c) => c.local_id === segment.localId);
    if (!citation) return segment.raw;

    return (
      <button
        key={`c-${key++}`}
        type="button"
        onClick={() => onCitationClick(citation)}
        className="mx-0.5 rounded bg-neutral-300 px-1.5 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-400 dark:bg-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-500"
      >
        {segment.localId}
      </button>
    );
  });
}

export function Chat({
  notebookId,
  initialMessages,
  sourceIds,
  suggestedQuestions,
  onCitationClick,
}: {
  notebookId: string;
  initialMessages: Message[];
  sourceIds: string[] | null;
  suggestedQuestions?: string[];
  onCitationClick: (citation: Citation) => void;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageIdCounter = useRef(0);

  function nextMessageId(prefix: string) {
    messageIdCounter.current += 1;
    return `${prefix}-${messageIdCounter.current}`;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submitQuestion(input.trim());
  }

  async function submitQuestion(question: string) {
    if (!question || pending) return;

    setInput("");
    setError(null);
    setPending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: nextMessageId("pending-user"),
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

      if (!res.ok || !res.body) {
        const responseBody = await res.json().catch(() => null);
        setError(responseBody?.error ?? "Fehler beim Senden der Frage.");
        return;
      }

      const citationsHeader = res.headers.get("X-Citations");
      const citations: Citation[] = citationsHeader
        ? JSON.parse(decodeURIComponent(citationsHeader))
        : [];

      const assistantId = nextMessageId("assistant");
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          notebook_id: notebookId,
          role: "assistant",
          content: "",
          citations,
          created_at: new Date().toISOString(),
        },
      ]);

      // Tokens erscheinen inkrementell im UI, sobald sie ankommen ([chunk:N]-
      // Marker koennen dabei fragmentiert reinkommen -- die Regex im Renderer
      // matcht dann einfach erst, sobald der Marker vollstaendig im Text steht).
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let content = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        const currentContent = content;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: currentContent } : m))
        );
      }
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
          <div className="flex flex-col gap-3">
            <p className="text-sm text-neutral-500">
              Stelle eine Frage zu den hochgeladenen Quellen.
            </p>
            {suggestedQuestions && suggestedQuestions.length > 0 && (
              <div className="flex flex-col items-start gap-2">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => submitQuestion(q)}
                    disabled={pending}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
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
