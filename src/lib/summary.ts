import type { createAdminClient } from "@/lib/supabase/admin";
import { summarizeSources } from "@/lib/groq";

const CHUNKS_PER_SOURCE = 3;

// Gemeinsame Logik fuer die Zusammenfassung, aufgerufen sowohl nach jedem
// Upload (CLAUDE.md Upload-Flow Schritt 8) als auch nach dem Loeschen einer
// Quelle -- die Zusammenfassung soll immer den aktuellen Quellenbestand
// widerspiegeln, nicht nur beim Hinzufuegen aktuell gehalten werden. Gibt es
// keine Quellen mehr, wird die gespeicherte Zusammenfassung geloescht statt
// veraltet stehen zu bleiben.
export type SummaryResult = { summary: string | null; usedFallbackModel: boolean };

export async function regenerateNotebookSummary(
  supabase: ReturnType<typeof createAdminClient>,
  notebookId: string
): Promise<SummaryResult> {
  const { data: sources } = await supabase
    .from("sources")
    .select("id, filename")
    .eq("notebook_id", notebookId);

  if (!sources || sources.length === 0) {
    await supabase.from("notebooks").update({ summary: null }).eq("id", notebookId);
    return { summary: null, usedFallbackModel: false };
  }

  const sourceIds = sources.map((s) => s.id);
  const { data: chunks } = await supabase
    .from("chunks")
    .select("source_id, chunk_index, content")
    .in("source_id", sourceIds)
    .order("chunk_index", { ascending: true });

  const chunksBySource = new Map<string, string[]>();
  for (const chunk of chunks ?? []) {
    const list = chunksBySource.get(chunk.source_id) ?? [];
    if (list.length < CHUNKS_PER_SOURCE) list.push(chunk.content);
    chunksBySource.set(chunk.source_id, list);
  }

  const context = sources
    .map((s) => `Quelle: ${s.filename}\n${(chunksBySource.get(s.id) ?? []).join("\n")}`)
    .join("\n\n");

  const { text: summary, usedFallbackModel } = await summarizeSources(context);

  await supabase.from("notebooks").update({ summary }).eq("id", notebookId);
  return { summary, usedFallbackModel };
}
