import { describe, expect, it } from "vitest";
import { parseAudioScript } from "./groq";

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
