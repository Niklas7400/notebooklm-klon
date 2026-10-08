import { createAdminClient } from "@/lib/supabase/admin";
import { generateSuggestedQuestions } from "@/lib/groq";

// Optionales Feature (siehe CLAUDE.md "Optional"): vorgeschlagene
// Einstiegsfragen nach Upload. Vom Frontend direkt nach der Summary neu
// angefordert, passt sich so an neu hinzugekommene Quellen an. Ergebnis wird
// in notebooks.suggested_questions ueberschrieben (wie die Zusammenfassung),
// sonst sind die Vorschlaege nach einem Reload bzw. erneutem Oeffnen des
// Notebooks weg statt weiterhin zu den aktuellen Quellen zu passen.
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

  const questions = await generateSuggestedQuestions(context);

  await supabase
    .from("notebooks")
    .update({ suggested_questions: questions })
    .eq("id", notebookId);

  return Response.json({ questions });
}
