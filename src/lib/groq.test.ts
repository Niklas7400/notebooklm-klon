import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAudioScript, rewriteQuery, stripMarkdownCodeFence, summarizeSources } from "./groq";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function groqSuccessBody(content: string) {
  return { choices: [{ message: { content } }] };
}

function groqRateLimitBody() {
  return {
    error: {
      message:
        "Rate limit reached for model `llama-3.3-70b-versatile` in organization `org_test` service tier `on_demand` on tokens per day (TPD): Limit 100000, Used 99640, Requested 3297. Please try again in 42m17.568s.",
      type: "tokens",
      code: "rate_limit_exceeded",
    },
  };
}

describe("Fallback-Modell bei Groq-Tageslimit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("faellt bei einem 429 des Hauptmodells automatisch auf das Ausweichmodell zurueck", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, groqRateLimitBody()))
      .mockResolvedValueOnce(jsonResponse(200, groqSuccessBody("Zusammenfassung vom Ausweichmodell")));
    vi.stubGlobal("fetch", fetchMock);

    const result = await summarizeSources("Quellenkontext");

    expect(result).toEqual({
      text: "Zusammenfassung vom Ausweichmodell",
      usedFallbackModel: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondCallBody.model).toBe("llama-3.1-8b-instant");
  });

  it("nutzt das Hauptmodell direkt, wenn es nicht rate-limitiert ist", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, groqSuccessBody("Normale Zusammenfassung")));
    vi.stubGlobal("fetch", fetchMock);

    const result = await summarizeSources("Quellenkontext");

    expect(result).toEqual({ text: "Normale Zusammenfassung", usedFallbackModel: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("wirft bei einem Nicht-Rate-Limit-Fehler die eigentliche Groq-Fehlermeldung, nicht den rohen JSON-Body", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, { error: { message: "Invalid API Key", type: "invalid_request_error" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(rewriteQuery("Frage", [])).rejects.toThrow("Invalid API Key");
  });
});

describe("parseAudioScript", () => {
  it("parst ein sauberes JSON-Array", () => {
    const raw = '[{"speaker":"A","text":"Hallo"},{"speaker":"B","text":"Hi zurück"}]';
    expect(parseAudioScript(raw)).toEqual([
      { speaker: "A", text: "Hallo" },
      { speaker: "B", text: "Hi zurück" },
    ]);
  });

  it("ist tolerant gegenüber Text vor/nach dem JSON-Array (z.B. Markdown-Codeblock)", () => {
    const raw = '```json\n[{"speaker":"A","text":"Hallo"}]\n```';
    expect(parseAudioScript(raw)).toEqual([{ speaker: "A", text: "Hallo" }]);
  });

  it("filtert Zeilen mit ungültigem Speaker oder leerem Text heraus", () => {
    const raw = JSON.stringify([
      { speaker: "A", text: "Gültig" },
      { speaker: "C", text: "Ungültiger Speaker" },
      { speaker: "B", text: "   " },
      { speaker: "B", text: "Auch gültig" },
    ]);
    expect(parseAudioScript(raw)).toEqual([
      { speaker: "A", text: "Gültig" },
      { speaker: "B", text: "Auch gültig" },
    ]);
  });

  it("loest einzelne Zeilen heraus, wenn das Modell mehrere separate Arrays statt eines einzigen liefert (live gegen das Fallback-Modell reproduziert)", () => {
    const raw = [
      '[{"speaker":"A","text":"Hallo und willkommen!"}]',
      '[{"speaker":"B","text":"Schön, dass du da bist."}]',
      '[{"speaker":"A","text":"Fangen wir an."}]',
    ].join("\n\n");
    expect(parseAudioScript(raw)).toEqual([
      { speaker: "A", text: "Hallo und willkommen!" },
      { speaker: "B", text: "Schön, dass du da bist." },
      { speaker: "A", text: "Fangen wir an." },
    ]);
  });

  it("wirft einen Fehler, wenn kein JSON-Array enthalten ist", () => {
    expect(() => parseAudioScript("Das ist kein JSON.")).toThrow(
      "Skript-Antwort enthielt kein JSON-Array."
    );
  });

  it("wirft einen Fehler, wenn nach dem Filtern keine gültigen Zeilen übrig bleiben", () => {
    const raw = JSON.stringify([{ speaker: "C", text: "Ungültig" }]);
    expect(() => parseAudioScript(raw)).toThrow(
      "Skript enthielt keine gültigen Gesprächs-Zeilen."
    );
  });
});

describe("stripMarkdownCodeFence", () => {
  it("gibt unveraendertes Markdown zurueck, wenn kein Codeblock vorhanden ist", () => {
    const raw = "# Titel\n## Ast\n- Punkt";
    expect(stripMarkdownCodeFence(raw)).toBe(raw);
  });

  it("entfernt einen ```markdown-Codeblock-Wrapper", () => {
    const raw = "```markdown\n# Titel\n## Ast\n- Punkt\n```";
    expect(stripMarkdownCodeFence(raw)).toBe("# Titel\n## Ast\n- Punkt");
  });

  it("entfernt einen Codeblock-Wrapper ohne Sprachangabe", () => {
    const raw = "```\n# Titel\n- Punkt\n```";
    expect(stripMarkdownCodeFence(raw)).toBe("# Titel\n- Punkt");
  });

  it("trimmt umgebende Leerzeichen/Zeilenumbrueche", () => {
    expect(stripMarkdownCodeFence("  \n# Titel\n  \n")).toBe("# Titel");
  });
});
