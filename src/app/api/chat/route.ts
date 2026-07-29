import { createAdminClient } from "@/lib/supabase/admin";
import { embedQuery } from "@/lib/voyage";
import { searchChunks } from "@/lib/retrieval";
import { rewriteQuery, streamAnswerQuestion, generateFollowUpQuestions, type ChatMessage } from "@/lib/groq";
import { buildSystemPrompt, buildCitations } from "@/lib/prompt";
import { FOLLOWUP_MARKER } from "@/lib/followups";
import type { Citation } from "@/lib/types";

// Chat/RAG-Flow (siehe CLAUDE.md): Guard -> Verlauf laden -> ggf. Query-Rewriting
// -> Embedding -> Aehnlichkeitssuche -> Groq-Antwort (gestreamt) -> Speichern.
//
// Streaming-Ansatz (Tag 6): Die Antwort wird als reiner Text-Stream an den
// Client geschickt. Die Zitate haengen nicht vom Antworttext ab (sie werden
// schon aus den match_chunks-Treffern gebaut, bevor das LLM ueberhaupt
// aufgerufen wird) und koennen deshalb sofort als Header mitgeschickt werden,
// statt auf das Streamende zu warten. Die vollstaendige Assistant-Nachricht
// wird erst persistiert, nachdem der Stream zu Ende gelesen wurde -- sonst
// waere der Chatverlauf nach einem Reload halb leer, obwohl das Streaming
// selbst einwandfrei lief.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 5;

function textStreamResponse(text: string, citations: Citation[]) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Citations": encodeURIComponent(JSON.stringify(citations)),
    },
  });
}

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
    return textStreamResponse(
      "Lade zuerst eine Quelle hoch, um Fragen stellen zu können.",
      []
    );
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
  const results = await searchChunks(notebookId, searchQuery, queryEmbedding, sourceIds);

  const systemPrompt = buildSystemPrompt(results);
  const citations = buildCitations(results);

  const encoder = new TextEncoder();
  let fullAnswer = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamAnswerQuestion(systemPrompt, history, question)) {
          fullAnswer += delta;
          controller.enqueue(encoder.encode(delta));
        }

        // Folgefragen brauchen den fertigen Antworttext als Kontext, koennen
        // also erst nach Streamende generiert werden -- als letzter Chunk
        // hinter dem Marker angehaengt (siehe lib/followups.ts). Scheitert
        // dieser Zusatz-Call, wird die eigentliche Antwort davon nicht
        // beeintraechtigt, es gibt dann einfach keine Folgefragen.
        try {
          const followUps = await generateFollowUpQuestions(question, fullAnswer);
          if (followUps.length > 0) {
            controller.enqueue(encoder.encode(FOLLOWUP_MARKER + JSON.stringify(followUps)));
          }
        } catch {
          // Nice-to-have, kein Fehlerfall fuer den Nutzer.
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unbekannter Fehler beim Streaming.";
        // Falls schon Text raus ist, den Fehler anhaengen statt den Stream
        // ohne Erklaerung abzubrechen.
        controller.enqueue(encoder.encode(`\n\n[Fehler: ${message}]`));
      } finally {
        // Nachricht + aufgeloeste Zitate erst nach Streamende persistieren,
        // sonst ist der Verlauf nach einem Reload halb leer.
        await supabase.from("messages").insert([
          { notebook_id: notebookId, role: "user", content: question },
          { notebook_id: notebookId, role: "assistant", content: fullAnswer, citations },
        ]);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Citations": encodeURIComponent(JSON.stringify(citations)),
    },
  });
}
