import type { Citation, MatchChunkResult } from "@/lib/types";

const SYSTEM_PROMPT_TEMPLATE = `Du bist ein Assistent, der ausschließlich auf Basis der bereitgestellten Quellenausschnitte antwortet.

Regeln:
- Beantworte die Frage nur mit Informationen aus den folgenden Ausschnitten.
- Wenn die Antwort nicht in den Ausschnitten enthalten ist, sage das explizit.
- Markiere jede Aussage mit einem Verweis auf die Nummer des Ausschnitts im Format [chunk:N], direkt hinter der Aussage.
- Verwende ausschließlich Nummern, die unten unter "Quellenausschnitte" tatsächlich aufgeführt sind. Erfinde niemals höhere oder zusätzliche Nummern, auch wenn du glaubst, die Information aus einer früheren Antwort zu kennen.

Beispiel (nur zur Veranschaulichung des Formats, nicht Teil der echten Quellen):
Quellenausschnitte:
[chunk:1] (Quelle: Beispiel.pdf)
Der Eiffelturm wurde 1889 fertiggestellt.
[chunk:2] (Quelle: Beispiel.pdf)
Er ist 330 Meter hoch.

Beispielantwort:
Der Eiffelturm wurde 1889 fertiggestellt [chunk:1] und ist 330 Meter hoch [chunk:2].

- Antworte in der Sprache, in der die Frage gestellt wurde (nicht zwingend Deutsch).

Quellenausschnitte:
{{chunks}}`;

export function buildSystemPrompt(results: MatchChunkResult[]): string {
  const chunksText = results.length
    ? results
        .map((r, i) => `[chunk:${i + 1}] (Quelle: ${r.filename})\n${r.content}`)
        .join("\n\n")
    : "(Keine passenden Ausschnitte in den Quellen gefunden.)";

  return SYSTEM_PROMPT_TEMPLATE.replace("{{chunks}}", chunksText);
}

// localId (Position in der Trefferliste, 1-basiert) -> echte Chunk-/Source-ID.
// Server-seitig schon aus der match_chunks-Antwort bekannt, kein zusaetzlicher
// DB-Call noetig, um [chunk:N] spaeter aufzuloesen. Voller Chunk-Text als
// Snippet (nicht gekuerzt) -- eine feste Zeichenzahl schneidet sonst je nach
// Chunk-Laenge mitten im zitierten Satz ab, die Sidebar scrollt bei Bedarf.
export function buildCitations(results: MatchChunkResult[]): Citation[] {
  return results.map((r, i) => ({
    local_id: i + 1,
    source_id: r.source_id,
    chunk_id: r.id,
    filename: r.filename,
    snippet: r.content,
  }));
}
