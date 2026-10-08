import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildCitations } from "./prompt";
import type { MatchChunkResult } from "./types";

const RESULTS: MatchChunkResult[] = [
  {
    id: "chunk-1",
    source_id: "source-1",
    filename: "Beispiel.pdf",
    content: "Der Eiffelturm wurde 1889 fertiggestellt.",
    chunk_index: 0,
    similarity: 0.91,
  },
  {
    id: "chunk-2",
    source_id: "source-2",
    filename: "Zweite-Quelle.txt",
    content: "Er ist 330 Meter hoch.",
    chunk_index: 3,
    similarity: 0.77,
  },
];

describe("buildSystemPrompt", () => {
  it("nummeriert Treffer fortlaufend ab 1 mit lokaler Kurz-ID, nicht der echten Chunk-ID", () => {
    const prompt = buildSystemPrompt(RESULTS);
    expect(prompt).toContain("[chunk:1] (Quelle: Beispiel.pdf)\nDer Eiffelturm wurde 1889 fertiggestellt.");
    expect(prompt).toContain("[chunk:2] (Quelle: Zweite-Quelle.txt)\nEr ist 330 Meter hoch.");
    expect(prompt).not.toContain("chunk-1");
  });

  it("weist bei fehlenden Treffern explizit darauf hin, statt einen leeren Block zu zeigen", () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain("(Keine passenden Ausschnitte in den Quellen gefunden.)");
  });

  it("enthaelt weiterhin die Kernregeln des System-Prompts", () => {
    const prompt = buildSystemPrompt(RESULTS);
    expect(prompt).toContain("[chunk:N]");
    expect(prompt).toContain("Erfinde niemals höhere oder zusätzliche Nummern");
  });
});

describe("buildCitations", () => {
  it("mappt Treffer auf Zitate mit lokaler ID, echter Chunk-/Source-ID und vollem Snippet", () => {
    const citations = buildCitations(RESULTS);
    expect(citations).toEqual([
      {
        local_id: 1,
        source_id: "source-1",
        chunk_id: "chunk-1",
        filename: "Beispiel.pdf",
        snippet: "Der Eiffelturm wurde 1889 fertiggestellt.",
      },
      {
        local_id: 2,
        source_id: "source-2",
        chunk_id: "chunk-2",
        filename: "Zweite-Quelle.txt",
        snippet: "Er ist 330 Meter hoch.",
      },
    ]);
  });

  it("gibt ein leeres Array zurueck, wenn keine Treffer vorliegen", () => {
    expect(buildCitations([])).toEqual([]);
  });
});
