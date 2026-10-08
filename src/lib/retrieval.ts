import { createAdminClient } from "@/lib/supabase/admin";
import { rerankTexts } from "@/lib/voyage";
import type { MatchChunkResult } from "@/lib/types";

// Treffer unterhalb dieser Schwelle sind bei thematisch fremden Fragen reine
// Rausch-Treffer -- verwerfen, damit die Prompt-Regel "sag explizit, wenn es
// nicht in den Quellen steht" tatsaechlich greifen kann.
const SIMILARITY_THRESHOLD = 0.3;
// Anzahl der Treffer, die tatsaechlich in den Prompt wandern -- am oberen
// Ende der in CLAUDE.md vorgegebenen Spanne (5-8), um die kleinere
// Chunk-Groesse (siehe chunking.ts) auszugleichen.
const FINAL_MATCH_COUNT = 8;
// Breiterer Kandidaten-Pool aus der Vektorsuche, der anschliessend per
// Cross-Encoder-Reranking (siehe rerankChunks) auf FINAL_MATCH_COUNT verdichtet
// wird. Skaliert unabhaengig von der Notebook-Groesse: der HNSW-Index liefert
// diese feste Kandidatenzahl in O(log n), egal ob ein Notebook 50 oder 50.000
// Chunks enthaelt -- das Reranking bewertet danach immer nur diesen konstanten
// Pool, nie den gesamten Chunk-Bestand.
const CANDIDATE_POOL_SIZE = 30;

export async function searchChunks(
  notebookId: string,
  query: string,
  queryEmbedding: number[],
  sourceIds?: string[] | null
): Promise<MatchChunkResult[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_notebook_id: notebookId,
    match_count: CANDIDATE_POOL_SIZE,
    match_source_ids: sourceIds ?? null,
  });

  if (error) {
    throw new Error(`match_chunks fehlgeschlagen: ${error.message}`);
  }

  const candidates = (data ?? []).filter((r) => r.similarity >= SIMILARITY_THRESHOLD);
  if (candidates.length === 0) return candidates;

  return rerankChunks(query, candidates);
}

// Cross-Encoder-Reranking (Voyage rerank-2-lite): bewertet Frage und Chunk-
// Text gemeinsam, statt wie die Vektorsuche oben nur ueber die Distanz zweier
// unabhaengig berechneter Embeddings -- deutlich praeziser bei grossen,
// unuebersichtlichen Notebooks mit vielen thematisch aehnlichen Chunks. Bei
// kleinen Kandidaten-Mengen (<= FINAL_MATCH_COUNT) gibt es nichts zu
// verdichten, der zusaetzliche API-Call entfaellt dann ganz. Reranking ist
// eine Qualitaets-Verbesserung, kein Correctness-Requirement -- schlaegt der
// Call fehl (Rate-Limit, Netzwerk), faellt die Funktion auf die reine
// Vektorsuche-Reihenfolge zurueck, statt den ganzen Chat-Request scheitern zu
// lassen.
async function rerankChunks(
  query: string,
  candidates: MatchChunkResult[]
): Promise<MatchChunkResult[]> {
  if (candidates.length <= FINAL_MATCH_COUNT) return candidates;

  try {
    const ranked = await rerankTexts(
      query,
      candidates.map((c) => c.content)
    );
    return ranked.slice(0, FINAL_MATCH_COUNT).map((r) => candidates[r.index]);
  } catch {
    return candidates.slice(0, FINAL_MATCH_COUNT);
  }
}
