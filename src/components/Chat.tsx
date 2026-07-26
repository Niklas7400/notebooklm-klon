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
        className="mx-0.5 inline-flex rounded-[5px] border-0 bg-accent-800 px-1.5 py-px text-[11px] font-medium text-accent-100"
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
  selectedCitation,
  onCitationClick,
  onCloseCitation,
}: {
  notebookId: string;
  initialMessages: Message[];
  sourceIds: string[] | null;
  suggestedQuestions?: string[];
  selectedCitation: Citation | null;
  onCitationClick: (citation: Citation) => void;
  onCloseCitation: () => void;
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
      <div className="flex-1 overflow-y-auto px-8 py-7">
        {messages.length === 0 ? (
          <div className="flex max-w-xl flex-col gap-4">
            <p className="m-0 text-sm text-neutral-400">
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
                    className="btn btn-secondary text-left font-normal"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <ul className="flex max-w-3xl flex-col gap-3.5">
            {messages.map((m) => (
              <li key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-[14px] px-3.5 py-2.5 text-sm leading-[1.55] ${
                    m.role === "user"
                      ? "bg-accent-800 text-accent-100"
                      : "border border-divider bg-surface text-text"
                  }`}
                >
                  {renderContent(m.content, m.citations, onCitationClick)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedCitation && (
        <div className="border-t border-divider bg-surface px-8 py-2.5">
          <div className="mb-1.5 flex max-w-3xl items-center justify-between gap-2">
            <span className="truncate text-xs font-medium" title={selectedCitation.filename}>
              {selectedCitation.filename}
            </span>
            <button
              type="button"
              onClick={onCloseCitation}
              className="shrink-0 cursor-pointer border-0 bg-transparent text-neutral-500 hover:text-neutral-300"
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>
          <p className="m-0 max-w-3xl text-[12.5px] leading-[1.6] text-neutral-400">
            {selectedCitation.snippet}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2.5 border-t border-divider px-8 py-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Frage stellen…"
          className="input max-w-3xl"
        />
        <button type="submit" disabled={pending} className="btn btn-primary shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4z" />
          </svg>
          Senden
        </button>
      </form>
      {error && (
        <p className="border-t border-divider px-8 py-2 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
