import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Kleiner als die urspruengliche ~500-Token-Vorgabe (1800-2000 Zeichen) aus
// CLAUDE.md: Beim Testen mit einem echten 24-seitigen PDF enthielt ein
// 1800-Zeichen-Chunk oft mehrere thematisch unterschiedliche Aufzaehlungs-
// punkte, wodurch der referenzierte Zitat-Ausschnitt mehr Kontext zeigte als
// fuer die konkrete Aussage noetig (siehe NOTES.md). 900 Zeichen mit
// proportional etwas hoeherem Overlap-Anteil (~17% statt ~11%) fuer feinere
// Zitat-Granularitaet bei weiterhin ausreichend Kontext pro Chunk.
export const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;

export async function chunkText(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  return splitter.splitText(text);
}
