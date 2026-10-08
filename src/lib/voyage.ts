const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/rerank";
const VOYAGE_MODEL = "voyage-4-lite";
const RERANK_MODEL = "rerank-2-lite";

// Voyage erlaubt bis zu 1000 Inputs/Request bzw. 1M Tokens bei voyage-4-lite;
// bei sehr langen Quellen trotzdem in kleineren Batches senden (siehe CLAUDE.md).
const BATCH_SIZE = 500;

async function embed(inputs: string[], inputType: "document" | "query"): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const res = await fetch(VOYAGE_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: batch,
        model: VOYAGE_MODEL,
        input_type: inputType,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Voyage AI Embedding-Request fehlgeschlagen (${res.status}): ${body}`);
    }

    const json = await res.json();
    // Voyage garantiert die Reihenfolge der Embeddings passend zum Input-Array,
    // liefert aber zusaetzlich einen `index` je Eintrag -- danach sortieren,
    // statt sich blind auf die Ankunftsreihenfolge zu verlassen.
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    results.push(...sorted.map((d) => d.embedding));
  }

  return results;
}

export function embedDocuments(texts: string[]): Promise<number[][]> {
  return embed(texts, "document");
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embed([text], "query");
  return embedding;
}

// Cross-Encoder-Reranking (RAG-Reranking, siehe README "Bekannte Grenzen"):
// bewertet Frage und Dokument gemeinsam, statt wie beim Bi-Encoder-Embedding
// oben nur ueber die Distanz zweier unabhaengig berechneter Vektoren --
// deutlich praezisere Relevanz-Einschaetzung fuer die finale Chunk-Auswahl.
// Sortiert nach relevance_score absteigend, damit Aufrufer direkt die
// gewuenschte Anzahl von vorne abschneiden koennen.
export async function rerankTexts(
  query: string,
  documents: string[]
): Promise<{ index: number; relevanceScore: number }[]> {
  const res = await fetch(VOYAGE_RERANK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      documents,
      model: RERANK_MODEL,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Voyage AI Rerank-Request fehlgeschlagen (${res.status}): ${body}`);
  }

  const json = await res.json();
  return (json.data as { index: number; relevance_score: number }[])
    .map((d) => ({ index: d.index, relevanceScore: d.relevance_score }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
