import { createAdminClient } from "@/lib/supabase/admin";
import { generateMindMap } from "@/lib/groq";

// Optionales Feature (urspruenglich bewusst ausgelassen, siehe CLAUDE.md) --
// Mind Map als verschachtelte Markdown-Gliederung, vom Frontend per Markmap
// zu einer interaktiven Grafik gerendert. Wird bei jedem Klick frisch
// generiert und in notebooks.mind_map ueberschrieben (wie Zusammenfassung
// und Study Guide), sonst ist sie nach einem Reload weg.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CHUNKS_PER_SOURCE = 3;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: notebookId } = await params;
  const supabase = createAdminClient();

  const { data: sources } = await supabase
    .from("sources")
    .select("id, filename")
    .eq("notebook_id", notebookId);

  if (!sources || sources.length === 0) {
    return Response.json({ error: "Keine Quellen vorhanden." }, { status: 422 });
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

  const { text: mindMap, usedFallbackModel } = await generateMindMap(context);

  await supabase.from("notebooks").update({ mind_map: mindMap }).eq("id", notebookId);

  return Response.json({ mindMap, usedFallbackModel });
}
