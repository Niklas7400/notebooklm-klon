// Upload-Flow: Text-Extraktion -> Chunking -> Embeddings -> Speicherung (siehe CLAUDE.md, Tag 2/3)
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({ error: "not implemented" }, { status: 501 });
}
