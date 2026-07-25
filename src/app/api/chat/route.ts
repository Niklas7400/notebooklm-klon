import { createAdminClient } from "@/lib/supabase/admin";
import { embedQuery } from "@/lib/voyage";
import { searchChunks } from "@/lib/retrieval";
import { rewriteQuery, answerQuestion, type ChatMessage } from "@/lib/groq";
import { buildSystemPrompt, buildCitations } from "@/lib/prompt";

// Chat/RAG-Flow (siehe CLAUDE.md): Guard -> Verlauf laden -> ggf. Query-Rewriting
// -> Embedding -> Aehnlichkeitssuche -> Groq-Antwort -> Speichern.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 5;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const notebookId = body?.notebookId;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const sourceIds: string[] | null = Array.isArray(body?.sourceIds) ? body.sourceIds : null;

  if (typeof notebookId !== "string" || !notebookId) {
    return Response.json({ error: "notebookId fehlt." }, { status: 400 });
  }
  if (!question) {
    return Response.json({ error: "Frage fehlt." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Guard: In einem Notebook ohne Quellen ins Leere zu embedden/suchen bringt
  // nichts -- direkt antworten, ohne API-Calls auszuloesen.
  const { data: existingSources } = await supabase
    .from("sources")
    .select("id")
    .eq("notebook_id", notebookId)
    .limit(1);

  if (!existingSources || existingSources.length === 0) {
    return Response.json({
      answer: "Lade zuerst eine Quelle hoch, um Fragen stellen zu können.",
      citations: [],
    });
  }

  const { data: historyRows } = await supabase
    .from("messages")
    .select("role, content")
    .eq("notebook_id", notebookId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: ChatMessage[] = (historyRows ?? [])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  // Folgefragen sind fuer die Aehnlichkeitssuche ohne Kontext wertlos --
  // nur umschreiben, wenn bereits Verlauf existiert (spart einen Hop bei der
  // allerersten Nachricht).
  const searchQuery = history.length > 0 ? await rewriteQuery(question, history) : question;

  const queryEmbedding = await embedQuery(searchQuery);
  const results = await searchChunks(notebookId, queryEmbedding, sourceIds);

  const systemPrompt = buildSystemPrompt(results);
  const answer = await answerQuestion(systemPrompt, history, question);
  const citations = buildCitations(results);

  await supabase.from("messages").insert([
    { notebook_id: notebookId, role: "user", content: question },
    { notebook_id: notebookId, role: "assistant", content: answer, citations },
  ]);

  return Response.json({ answer, citations });
}
