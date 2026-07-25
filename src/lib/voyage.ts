const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-4-lite";

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
