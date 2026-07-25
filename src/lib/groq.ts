const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const CHAT_MODEL = "llama-3.3-70b-versatile";
const REWRITE_MODEL = "llama-3.1-8b-instant";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function groqChat(model: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq-Request fehlgeschlagen (${res.status}): ${body}`);
  }

  const json = await res.json();
  return json.choices[0].message.content as string;
}

// Formt Frage + Verlauf zu einer eigenstaendigen Suchanfrage um (Folgefragen
// wie "Und was sagt der Autor dazu?" sind fuer die Aehnlichkeitssuche sonst
// wertlos). Nur aufrufen, wenn bereits Verlauf existiert.
export async function rewriteQuery(
  question: string,
  history: ChatMessage[]
): Promise<string> {
  const historyText = history
    .map((m) => `${m.role === "user" ? "Nutzer" : "Assistent"}: ${m.content}`)
    .join("\n");

  const prompt = `Formuliere die folgende Frage anhand des Gespraechsverlaufs als eigenstaendige Suchanfrage um. Antworte NUR mit der umformulierten Frage, ohne Anfuehrungszeichen oder Erklaerung.

Verlauf:
${historyText}

Frage: ${question}`;

  const result = await groqChat(REWRITE_MODEL, [{ role: "user", content: prompt }]);
  return result.trim();
}

export function answerQuestion(
  systemPrompt: string,
  history: ChatMessage[],
  question: string
): Promise<string> {
  return groqChat(CHAT_MODEL, [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: question },
  ]);
}

// Streaming-Variante fuer den Chat (Tag 6): liefert die Antwort als Folge von
// Text-Deltas statt einmalig am Stueck, damit das Frontend Tokens anzeigen
// kann, sobald sie ankommen. Groq streamt im gleichen SSE-Format wie OpenAI
// ("data: {...}\n\n", abgeschlossen mit "data: [DONE]").
export async function* streamAnswerQuestion(
  systemPrompt: string,
  history: ChatMessage[],
  question: string
): AsyncGenerator<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: question },
  ];

  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: CHAT_MODEL, messages, stream: true }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq-Streaming-Request fehlgeschlagen (${res.status}): ${body}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;

      const json = JSON.parse(data);
      const delta: string | undefined = json.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

// Notebook Guide: kurze Zusammenfassung ueber alle Quellen, bei jedem Upload
// neu erzeugt (nicht nur beim ersten), damit sie nach dem zweiten Upload
// nicht veraltet wirkt.
export function summarizeSources(context: string): Promise<string> {
  const prompt = `Erstelle eine kurze, gut lesbare Zusammenfassung ("Notebook Guide") der folgenden Quellen fuer jemanden, der sich schnell einen Ueberblick verschaffen will. 3-6 Saetze oder kurze Bullet Points, die die Kernaussagen aller Quellen zusammen abdecken. Antworte in der Sprache der Quellen.

Quellen:
${context}`;

  return groqChat(CHAT_MODEL, [{ role: "user", content: prompt }]);
}
