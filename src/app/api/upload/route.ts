import { createAdminClient } from "@/lib/supabase/admin";
import { extractPdfText, fetchUrlText, validateSourceText } from "@/lib/ingestion";
import { chunkText } from "@/lib/chunking";
import { embedDocuments } from "@/lib/voyage";

// Upload-Flow: Text-Extraktion -> Validierung -> Speichern -> Chunking ->
// Batch-Embeddings -> Speichern (siehe CLAUDE.md). Die Zusammenfassung wird
// als separater, vom Frontend ausgeloester Request nachgereicht (Tag 5).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const notebookId = form.get("notebookId");
  if (typeof notebookId !== "string" || !notebookId) {
    return Response.json({ error: "notebookId fehlt." }, { status: 400 });
  }

  const file = form.get("file");
  const pastedText = form.get("text");
  const sourceUrl = form.get("url");

  let rawText: string;
  let filename: string;

  if (file instanceof File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json(
        { error: "Nur PDF-Dateien werden als Datei-Upload unterstützt." },
        { status: 400 }
      );
    }
    const buffer = await file.arrayBuffer();
    try {
      rawText = await extractPdfText(buffer);
    } catch {
      return Response.json(
        { error: "PDF konnte nicht gelesen werden — evtl. beschädigt oder verschlüsselt." },
        { status: 400 }
      );
    }
    filename = file.name;
  } else if (typeof pastedText === "string" && pastedText.trim()) {
    rawText = pastedText.trim();
    const providedName = form.get("filename");
    filename =
      typeof providedName === "string" && providedName.trim()
        ? providedName.trim()
        : "Eingefügter Text";
  } else if (typeof sourceUrl === "string" && sourceUrl.trim()) {
    let fetched: { text: string; title: string | null };
    try {
      fetched = await fetchUrlText(sourceUrl.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "URL konnte nicht geladen werden.";
      return Response.json({ error: message }, { status: 422 });
    }
    rawText = fetched.text;
    filename = fetched.title ?? sourceUrl.trim();
  } else {
    return Response.json(
      { error: "Weder Datei, Text noch URL übergeben." },
      { status: 400 }
    );
  }

  const validationError = validateSourceText(rawText);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 422 });
  }

  const supabase = createAdminClient();
  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .insert({ notebook_id: notebookId, filename, raw_text: rawText })
    .select()
    .single();

  if (sourceError) {
    return Response.json({ error: sourceError.message }, { status: 500 });
  }

  const chunks = await chunkText(rawText);

  try {
    const embeddings = await embedDocuments(chunks);

    const { error: chunksError } = await supabase.from("chunks").insert(
      chunks.map((content, i) => ({
        source_id: source.id,
        content,
        embedding: embeddings[i],
        chunk_index: i,
      }))
    );
    if (chunksError) throw new Error(chunksError.message);
  } catch (err) {
    // Ohne Chunks/Embeddings ist die Quelle nicht durchsuchbar -- lieber
    // sauber abbrechen (inkl. Aufraeumen) statt eine unvollstaendige Quelle
    // stehen zu lassen, die im Chat nie Treffer liefert.
    await supabase.from("sources").delete().eq("id", source.id);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return Response.json(
      { error: `Embeddings konnten nicht erzeugt werden: ${message}` },
      { status: 502 }
    );
  }

  return Response.json({ ...source, chunkCount: chunks.length }, { status: 201 });
}
