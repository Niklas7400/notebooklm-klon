import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_TITLE_LENGTH = 200;

// Optionales Feature (siehe CLAUDE.md "Optional"): Notebook umbenennen.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!title) {
    return Response.json({ error: "Titel darf nicht leer sein." }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return Response.json(
      { error: `Titel darf maximal ${MAX_TITLE_LENGTH} Zeichen lang sein.` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: notebook, error } = await supabase
    .from("notebooks")
    .update({ title })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!notebook) {
    return Response.json({ error: "Notebook nicht gefunden." }, { status: 404 });
  }

  return Response.json(notebook);
}

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
