import { createAdminClient } from "@/lib/supabase/admin";
import { extractPdfText, validateSourceText } from "@/lib/ingestion";

// Upload-Flow: Text-Extraktion -> Validierung -> Speichern (siehe CLAUDE.md).
// Chunking + Embeddings folgen als separater Schritt (Tag 3).
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
  } else {
    return Response.json(
      { error: "Weder Datei noch Text übergeben." },
      { status: 400 }
    );
  }

  const validationError = validateSourceText(rawText);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 422 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sources")
    .insert({ notebook_id: notebookId, filename, raw_text: rawText })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
