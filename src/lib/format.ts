// Serverseitig aufgerufen (page.tsx ist ein Server Component, "force-dynamic"
// -- pro Request frisch berechnet), nicht in einer Client-Komponente waehrend
// des Renderns, da Date.now() dort als impure Call gegen die Idempotenz-
// Anforderung von React-Renderfunktionen verstoesst.
export function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Minute${minutes === 1 ? "" : "n"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Stunde${hours === 1 ? "" : "n"}`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `vor ${weeks} Woche${weeks === 1 ? "" : "n"}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `vor ${months} Monat${months === 1 ? "" : "en"}`;

  const years = Math.floor(days / 365);
  return `vor ${years} Jahr${years === 1 ? "" : "en"}`;
}

export function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}
