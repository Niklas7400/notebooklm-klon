import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: notebook } = await supabase
    .from("notebooks")
    .select("is_demo")
    .eq("id", id)
    .single();

  if (!notebook) {
    return Response.json({ error: "Notebook nicht gefunden." }, { status: 404 });
  }

  // Schuetzt das vorbefuellte Demo-Notebook vor versehentlichem Loeschen
  // (siehe CLAUDE.md) -- sonst sieht der naechste Reviewer eine leere App.
  if (notebook.is_demo) {
    return Response.json(
      { error: "Das Demo-Notebook kann nicht gelöscht werden." },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("notebooks").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
