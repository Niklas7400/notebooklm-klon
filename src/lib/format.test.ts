import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeDate, truncate } from "./format";

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gibt 'gerade eben' fuer Zeitpunkte unter einer Minute zurueck", () => {
    expect(formatRelativeDate(new Date("2026-01-15T11:59:45.000Z").toISOString())).toBe(
      "gerade eben"
    );
  });

  it("zeigt Minuten korrekt an, inkl. Singular", () => {
    expect(formatRelativeDate(new Date("2026-01-15T11:59:00.000Z").toISOString())).toBe(
      "vor 1 Minute"
    );
    expect(formatRelativeDate(new Date("2026-01-15T11:55:00.000Z").toISOString())).toBe(
      "vor 5 Minuten"
    );
  });

  it("zeigt Stunden korrekt an", () => {
    expect(formatRelativeDate(new Date("2026-01-15T09:00:00.000Z").toISOString())).toBe(
      "vor 3 Stunden"
    );
  });

  it("zeigt 'gestern' fuer genau einen Tag Differenz", () => {
    expect(formatRelativeDate(new Date("2026-01-14T12:00:00.000Z").toISOString())).toBe(
      "gestern"
    );
  });

  it("zeigt Tage fuer 2-6 Tage Differenz", () => {
    expect(formatRelativeDate(new Date("2026-01-12T12:00:00.000Z").toISOString())).toBe(
      "vor 3 Tagen"
    );
  });

  it("zeigt Wochen ab 7 Tagen Differenz", () => {
    expect(formatRelativeDate(new Date("2026-01-01T12:00:00.000Z").toISOString())).toBe(
      "vor 2 Wochen"
    );
  });
});

describe("truncate", () => {
  it("laesst Text unter dem Limit unveraendert", () => {
    expect(truncate("Kurzer Text.", 100)).toBe("Kurzer Text.");
  });

  it("kuerzt Text ueber dem Limit und haengt eine Ellipse an", () => {
    const text = "a".repeat(150);
    const result = truncate(text, 100);
    expect(result).toBe(`${"a".repeat(100)}…`);
  });

  it("entfernt Leerraum am Rand vor der Laengenpruefung", () => {
    expect(truncate("  Text mit Leerraum.  ", 100)).toBe("Text mit Leerraum.");
  });
});
