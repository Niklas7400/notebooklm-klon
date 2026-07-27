// Folgefragen werden erst generiert, nachdem die eigentliche Antwort
// vollstaendig durchgestreamt ist (der Groq-Call dafuer braucht den fertigen
// Antworttext als Kontext). Sie kommen deshalb als ein zusaetzlicher, letzter
// Chunk am Streamende an -- durch diesen Marker vom eigentlichen Antworttext
// abgetrennt, damit der Client ihn nicht versehentlich mit anzeigt. Das
// Section-Sign-Zeichen kommt in normalem Fliesstext praktisch nie vor.
export const FOLLOWUP_MARKER = "\n§§FOLLOWUPS§§";

export function stripFollowUpMarker(raw: string): string {
  const idx = raw.indexOf(FOLLOWUP_MARKER);
  return idx === -1 ? raw : raw.slice(0, idx);
}

export function parseFollowUpQuestions(raw: string): string[] {
  const idx = raw.indexOf(FOLLOWUP_MARKER);
  if (idx === -1) return [];

  const jsonPart = raw.slice(idx + FOLLOWUP_MARKER.length).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPart);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((q): q is string => typeof q === "string" && q.trim().length > 0);
}
