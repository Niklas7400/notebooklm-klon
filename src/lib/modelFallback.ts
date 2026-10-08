// Gemeinsamer Marker + Hinweistext fuer alle Groq-gestuetzten Features
// (Chat, Zusammenfassung, Study Guide, Mind Map, Audio Overview): das
// Hauptmodell (llama-3.3-70b-versatile) hat ein Tageslimit (TPD), das bei
// intensivem Testen/Demo-Betrieb erreicht werden kann. Statt dann einen
// rohen Rate-Limit-Fehler zu zeigen, faellt groq.ts automatisch auf ein
// separat limitiertes Ausweichmodell zurueck -- dieser Hinweis macht das an
// allen Stellen einheitlich fuer den Nutzer sichtbar.
export const FALLBACK_MODEL_MARKER = "§§FALLBACK_MODEL§§";

export const FALLBACK_MODEL_NOTICE =
  "Hinweis: Das Hauptmodell hat sein Tageslimit erreicht, diese Antwort wurde mit einem kleineren Ausweichmodell erstellt.";

export function containsFallbackModelMarker(raw: string): boolean {
  return raw.includes(FALLBACK_MODEL_MARKER);
}

export function stripFallbackModelMarker(raw: string): string {
  return raw.split(FALLBACK_MODEL_MARKER).join("");
}
