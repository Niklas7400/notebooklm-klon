import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Optionales Feature (siehe CLAUDE.md "Optional"): Klick auf eine Quelle
// zeigt ihren Volltext an. raw_text liegt bereits vollstaendig in der DB,
// kein zusaetzlicher LLM-Call noetig.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: source } = await supabase
    .from("sources")
    .select("filename, raw_text")
    .eq("id", id)
    .maybeSingle();

  if (!source) {
    return Response.json({ error: "Quelle nicht gefunden." }, { status: 404 });
  }

  return Response.json(source);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase.from("sources").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
