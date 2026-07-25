import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// ~500 Tokens pro Chunk entspricht ca. 1800-2000 Zeichen (der Splitter zaehlt
// Zeichen, keine Tokens), etwas Overlap fuer Kontext an Chunk-Grenzen.
const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;

export async function chunkText(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  return splitter.splitText(text);
}
