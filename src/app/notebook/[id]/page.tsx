import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotebookWorkspace } from "@/components/NotebookWorkspace";

export const dynamic = "force-dynamic";

export default async function NotebookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: notebook }, { data: sources }, { data: messages }] = await Promise.all([
    supabase.from("notebooks").select("*").eq("id", id).single(),
    supabase
      .from("sources")
      .select("id, filename")
      .eq("notebook_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("messages")
      .select("*")
      .eq("notebook_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!notebook) notFound();

  return (
    <NotebookWorkspace
      notebook={notebook}
      sources={sources ?? []}
      initialMessages={messages ?? []}
    />
  );
}
