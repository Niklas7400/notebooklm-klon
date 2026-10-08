import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// "Chat zuruecksetzen": loescht den gesamten Nachrichtenverlauf eines
// Notebooks, laesst Notebook/Quellen/Zusammenfassung unangetastet.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: notebookId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase.from("messages").delete().eq("notebook_id", notebookId);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
