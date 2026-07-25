import { describe, expect, it } from "vitest";
import { chunkText } from "./chunking";

describe("chunkText", () => {
  it("gibt kurzen Text als einzelnen Chunk zurueck", async () => {
    const chunks = await chunkText("Ein kurzer Satz.");
    expect(chunks).toEqual(["Ein kurzer Satz."]);
  });

  it("zerlegt langen Text in mehrere Chunks innerhalb der Groessengrenze", async () => {
    const longText = "Ein Satz zum Testen des Chunkings. ".repeat(200); // ~7000 Zeichen
    const chunks = await chunkText(longText);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1800);
    }
  });

  it("behaelt den Gesamtinhalt ueber alle Chunks hinweg sinngemaess (kein Datenverlust)", async () => {
    const longText = "Ein Satz zum Testen des Chunkings. ".repeat(200);
    const chunks = await chunkText(longText);
    const rejoined = chunks.join("");

    expect(rejoined.length).toBeGreaterThanOrEqual(longText.trim().length);
  });
});
