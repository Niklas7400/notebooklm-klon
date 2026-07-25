import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeSources } from "@/lib/groq";

// Separater, vom Frontend ausgeloester Request nach jedem Upload (siehe
// CLAUDE.md Upload-Flow Schritt 8) -- nicht Teil des Upload-Requests selbst.
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
    return Response.json({ error: "Keine Quellen vorhanden." }, { status: 400 });
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

  const summary = await summarizeSources(context);

  const { error } = await supabase
    .from("notebooks")
    .update({ summary })
    .eq("id", notebookId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ summary });
}
