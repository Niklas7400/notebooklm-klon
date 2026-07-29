import { createAdminClient } from "@/lib/supabase/admin";
import { regenerateNotebookSummary } from "@/lib/summary";

// Separater, vom Frontend ausgeloester Request nach jedem Upload (siehe
// CLAUDE.md Upload-Flow Schritt 8) -- nicht Teil des Upload-Requests selbst.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: notebookId } = await params;
  const supabase = createAdminClient();

  const { count } = await supabase
    .from("sources")
    .select("id", { count: "exact", head: true })
    .eq("notebook_id", notebookId);

  if (!count) {
    return Response.json({ error: "Keine Quellen vorhanden." }, { status: 400 });
  }

  const { summary, usedFallbackModel } = await regenerateNotebookSummary(supabase, notebookId);
  return Response.json({ summary, usedFallbackModel });
}
