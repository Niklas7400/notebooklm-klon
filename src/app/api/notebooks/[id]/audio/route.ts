import { createAdminClient } from "@/lib/supabase/admin";
import { generateAudioScript } from "@/lib/groq";
import { synthesizeSpeech } from "@/lib/tts";
import type { AudioScriptLine } from "@/lib/types";

// Audio-Overview-Flow (Tag 8, siehe CLAUDE.md): Skript-Generierung -> pro
// Zeile ein TTS-Call -> Upload nach Supabase Storage -> Skript + Clip-URLs
// in notebooks speichern. On-demand ueber diesen Endpoint ausgeloest, nicht
// automatisch bei jedem Upload (TTS hat ein begrenztes Freikontingent).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CHUNKS_PER_SOURCE = 3;
const AUDIO_BUCKET = "audio-clips";
const TTS_CONCURRENCY = 4;

async function ensureAudioBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { error } = await supabase.storage.createBucket(AUDIO_BUCKET, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new Error(`Storage-Bucket konnte nicht angelegt werden: ${error.message}`);
  }
}

type SynthesisResult = { buffer: Buffer | null; error: string | null };

// Ein fehlgeschlagener TTS-Call darf den ganzen Flow nicht abbrechen -- einmal
// erneut versuchen, sonst die Zeile ueberspringen (Skript behaelt die Zeile,
// nur der Audio-Clip fehlt). Der konkrete Fehler wird trotzdem festgehalten
// (statt ihn stillschweigend zu verwerfen), damit sich der Nutzer nicht mit
// einer nichtssagenden Sammelmeldung wiederfindet, falls wirklich jede Zeile
// scheitert -- z.B. weil das Google-TTS-Kontingent aufgebraucht ist.
async function synthesizeWithRetry(line: AudioScriptLine): Promise<SynthesisResult> {
  try {
    return { buffer: await synthesizeSpeech(line.text, line.speaker), error: null };
  } catch {
    try {
      return { buffer: await synthesizeSpeech(line.text, line.speaker), error: null };
    } catch (err) {
      return { buffer: null, error: err instanceof Error ? err.message : "Unbekannter TTS-Fehler." };
    }
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: notebookId } = await params;
  const supabase = createAdminClient();

  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id, summary")
    .eq("id", notebookId)
    .maybeSingle();

  if (!notebook) {
    return Response.json({ error: "Notebook nicht gefunden." }, { status: 404 });
  }

  const { data: sources } = await supabase
    .from("sources")
    .select("id, filename")
    .eq("notebook_id", notebookId);

  if (!sources || sources.length === 0) {
    return Response.json({ error: "Notebook hat noch keine Quellen." }, { status: 422 });
  }

  // Atomares "Claiming" statt Select-dann-Update: Zwei parallele Requests
  // (Doppelklick, zwei Tabs) wuerden bei getrennten SELECT+UPDATE-Schritten
  // beide den alten Status sehen und beide eine volle Generierung starten.
  // Die WHERE-Bedingung im UPDATE selbst wird von Postgres pro Zeile
  // atomar ausgewertet -- nur der zuerst ankommende Request bekommt eine
  // Zeile zurueck und darf generieren.
  const { data: claimed, error: claimError } = await supabase
    .from("notebooks")
    .update({ audio_status: "generating" })
    .eq("id", notebookId)
    .neq("audio_status", "generating")
    .select("id")
    .maybeSingle();

  if (claimError) {
    return Response.json({ error: claimError.message }, { status: 500 });
  }
  if (!claimed) {
    return Response.json(
      { error: "Audio Overview wird bereits generiert." },
      { status: 409 }
    );
  }

  try {
    await ensureAudioBucket(supabase);

    // Gleicher Kontext-Aufbau wie beim Summary-Flow: Zusammenfassung + die
    // ersten paar Chunks jeder Quelle, nicht der komplette Rohtext.
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

    const sourcesContext = sources
      .map((s) => `Quelle: ${s.filename}\n${(chunksBySource.get(s.id) ?? []).join("\n")}`)
      .join("\n\n");
    const context = notebook.summary
      ? `Zusammenfassung:\n${notebook.summary}\n\n${sourcesContext}`
      : sourcesContext;

    const { script, usedFallbackModel } = await generateAudioScript(context);

    // TTS-Calls in kleinen Batches statt rein sequenziell -- schneller, bleibt
    // aber innerhalb des Vercel-Timeouts (maxDuration 60s).
    const synthesisResults: SynthesisResult[] = [];
    for (let i = 0; i < script.length; i += TTS_CONCURRENCY) {
      const batch = script.slice(i, i + TTS_CONCURRENCY);
      const batchResults = await Promise.all(batch.map(synthesizeWithRetry));
      synthesisResults.push(...batchResults);
    }

    // Cache-Busting-Suffix fuer alle Clips dieser Generierung: der Storage-
    // Pfad ist deterministisch (notebookId/i.mp3) und wird bei jeder
    // Neu-Generierung per upsert ueberschrieben, die Public-URL bliebe also
    // sonst identisch. Browser (und ggf. ein CDN davor) cachen Audio-Dateien
    // aggressiv pro URL und wuerden nach einem "Neu generieren" weiterhin die
    // alte, gecachte Version abspielen, ohne dass der geaenderte Inhalt
    // ueberhaupt neu angefragt wird.
    const generatedAt = Date.now();
    const clipUrls: (string | null)[] = [];
    const lineErrors: (string | null)[] = [];
    for (let i = 0; i < synthesisResults.length; i++) {
      const { buffer, error: synthError } = synthesisResults[i];
      if (!buffer) {
        clipUrls.push(null);
        lineErrors.push(synthError);
        continue;
      }
      const path = `${notebookId}/${i}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(path, buffer, { contentType: "audio/mpeg", upsert: true });

      if (uploadError) {
        clipUrls.push(null);
        lineErrors.push(`Speichern fehlgeschlagen: ${uploadError.message}`);
        continue;
      }
      const { data: publicUrlData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path);
      clipUrls.push(`${publicUrlData.publicUrl}?v=${generatedAt}`);
      lineErrors.push(null);
    }

    // audio_status nur dann 'failed', wenn wirklich nichts brauchbares
    // generiert wurde -- ein einzelner fehlgeschlagener Clip reicht nicht.
    const audioStatus = clipUrls.some((url) => url !== null) ? "ready" : "failed";

    // Scheitern wirklich alle Zeilen, den konkreten Grund der ersten
    // fehlgeschlagenen Zeile zeigen statt einer nichtssagenden
    // Sammelmeldung -- sonst sieht die Ursache (z.B. Google-TTS-Kontingent
    // aufgebraucht, Auth-Fehler) je nach Zufall der Zeilenreihenfolge immer
    // gleich aus, obwohl sie es nicht ist.
    const ttsError = audioStatus === "failed" ? lineErrors.find((e) => e) ?? null : null;

    await supabase
      .from("notebooks")
      .update({ audio_script: script, audio_clip_urls: clipUrls, audio_status: audioStatus })
      .eq("id", notebookId);

    return Response.json({
      script,
      clipUrls,
      audioStatus,
      usedFallbackModel,
      error: ttsError ? `Kein Audio-Clip konnte erzeugt werden (${ttsError})` : undefined,
    });
  } catch (err) {
    await supabase.from("notebooks").update({ audio_status: "failed" }).eq("id", notebookId);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return Response.json({ error: message }, { status: 502 });
  }
}
