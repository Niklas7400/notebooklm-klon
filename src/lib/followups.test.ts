import { describe, expect, it } from "vitest";
import { FOLLOWUP_MARKER, parseFollowUpQuestions, stripFollowUpMarker } from "./followups";

describe("stripFollowUpMarker", () => {
  it("gibt den Text unveraendert zurueck, wenn kein Marker vorhanden ist", () => {
    expect(stripFollowUpMarker("Das ist die Antwort.")).toBe("Das ist die Antwort.");
  });

  it("schneidet den Marker und alles danach ab", () => {
    const raw = `Das ist die Antwort.${FOLLOWUP_MARKER}["Frage 1?","Frage 2?"]`;
    expect(stripFollowUpMarker(raw)).toBe("Das ist die Antwort.");
  });
});

describe("parseFollowUpQuestions", () => {
  it("gibt ein leeres Array zurueck, wenn kein Marker vorhanden ist", () => {
    expect(parseFollowUpQuestions("Das ist die Antwort.")).toEqual([]);
  });

  it("parst ein gueltiges JSON-Array nach dem Marker", () => {
    const raw = `Antwort.${FOLLOWUP_MARKER}["Frage 1?","Frage 2?","Frage 3?"]`;
    expect(parseFollowUpQuestions(raw)).toEqual(["Frage 1?", "Frage 2?", "Frage 3?"]);
  });

  it("gibt ein leeres Array bei kaputtem JSON zurueck", () => {
    const raw = `Antwort.${FOLLOWUP_MARKER}[nicht valides json`;
    expect(parseFollowUpQuestions(raw)).toEqual([]);
  });

  it("gibt ein leeres Array zurueck, wenn das JSON kein Array ist", () => {
    const raw = `Antwort.${FOLLOWUP_MARKER}{"foo":"bar"}`;
    expect(parseFollowUpQuestions(raw)).toEqual([]);
  });

  it("filtert leere und nicht-string Eintraege raus", () => {
    const raw = `Antwort.${FOLLOWUP_MARKER}["Frage 1?", "", 42, "  ", "Frage 2?"]`;
    expect(parseFollowUpQuestions(raw)).toEqual(["Frage 1?", "Frage 2?"]);
  });
});
