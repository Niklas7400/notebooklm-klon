import { createAdminClient } from "@/lib/supabase/admin";
import type { MatchChunkResult } from "@/lib/types";

// Treffer unterhalb dieser Schwelle sind bei thematisch fremden Fragen reine
// Rausch-Treffer -- verwerfen, damit die Prompt-Regel "sag explizit, wenn es
// nicht in den Quellen steht" tatsaechlich greifen kann.
const SIMILARITY_THRESHOLD = 0.3;
const DEFAULT_MATCH_COUNT = 6;

export async function searchChunks(
  notebookId: string,
  queryEmbedding: number[],
  sourceIds?: string[] | null
): Promise<MatchChunkResult[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_notebook_id: notebookId,
    match_count: DEFAULT_MATCH_COUNT,
    match_source_ids: sourceIds ?? null,
  });

  if (error) {
    throw new Error(`match_chunks fehlgeschlagen: ${error.message}`);
  }

  return (data ?? []).filter((r) => r.similarity >= SIMILARITY_THRESHOLD);
}
