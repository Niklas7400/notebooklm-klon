import { describe, expect, it } from "vitest";
import { hasCitation, splitContentByCitations } from "./citations";

describe("splitContentByCitations", () => {
  it("erkennt das Standardformat [chunk:N]", () => {
    const segments = splitContentByCitations("Der Eiffelturm ist hoch [chunk:2].");
    expect(segments).toEqual([
      { type: "text", value: "Der Eiffelturm ist hoch " },
      { type: "citation", localId: 2, raw: "[chunk:2]" },
      { type: "text", value: "." },
    ]);
  });

  it("ist tolerant gegenueber Abweichungen ohne eckige Klammern (chunk:N)", () => {
    const segments = splitContentByCitations("Aussage chunk:1 mit Beleg.");
    expect(segments).toContainEqual({ type: "citation", localId: 1, raw: "chunk:1" });
  });

  it("erkennt mehrere Zitate in einer Antwort in der richtigen Reihenfolge", () => {
    const segments = splitContentByCitations("A [chunk:1] B [chunk:2] C");
    const citationIds = segments
      .filter((s) => s.type === "citation")
      .map((s) => s.localId);
    expect(citationIds).toEqual([1, 2]);
  });

  it("gibt Text ohne Zitate unveraendert als einzelnes Segment zurueck", () => {
    const segments = splitContentByCitations("Kein Zitat hier.");
    expect(segments).toEqual([{ type: "text", value: "Kein Zitat hier." }]);
  });
});

describe("hasCitation", () => {
  it("erkennt eine Antwort mit Standard-Zitat", () => {
    expect(hasCitation("Der Eiffelturm ist hoch [chunk:1].")).toBe(true);
  });

  it("erkennt eine Antwort mit tolerantem Zitat-Format ohne Klammern", () => {
    expect(hasCitation("Aussage chunk:2 mit Beleg.")).toBe(true);
  });

  it("erkennt eine Ablehnungsantwort ohne jedes Zitat als negativ", () => {
    expect(hasCitation("Dazu enthalten die Quellen keine Informationen.")).toBe(false);
  });

  it("mutiert nicht den lastIndex der geteilten CITATION_REGEX-Konstante (mehrfacher Aufruf bleibt konsistent)", () => {
    expect(hasCitation("Text mit [chunk:1].")).toBe(true);
    expect(hasCitation("Text mit [chunk:1].")).toBe(true);
  });
});
