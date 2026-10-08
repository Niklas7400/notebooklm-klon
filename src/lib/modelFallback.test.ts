import { describe, expect, it } from "vitest";
import {
  containsFallbackModelMarker,
  stripFallbackModelMarker,
  FALLBACK_MODEL_MARKER,
} from "./modelFallback";

describe("containsFallbackModelMarker", () => {
  it("erkennt den Marker, wenn er im Text vorkommt", () => {
    expect(containsFallbackModelMarker(`${FALLBACK_MODEL_MARKER}Hallo Welt`)).toBe(true);
  });

  it("erkennt normalen Text ohne Marker korrekt als negativ", () => {
    expect(containsFallbackModelMarker("Ganz normale Antwort ohne Marker.")).toBe(false);
  });
});

describe("stripFallbackModelMarker", () => {
  it("entfernt den Marker, laesst den restlichen Text unveraendert", () => {
    expect(stripFallbackModelMarker(`${FALLBACK_MODEL_MARKER}Hallo Welt`)).toBe("Hallo Welt");
  });

  it("laesst Text ohne Marker unveraendert", () => {
    expect(stripFallbackModelMarker("Ganz normale Antwort.")).toBe("Ganz normale Antwort.");
  });

  it("entfernt mehrere Vorkommen des Markers", () => {
    expect(
      stripFallbackModelMarker(`${FALLBACK_MODEL_MARKER}A${FALLBACK_MODEL_MARKER}B`)
    ).toBe("AB");
  });
});
