import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" && body.title.trim()
    ? body.title.trim()
    : "Neues Notebook";

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notebooks")
    .insert({ title })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
