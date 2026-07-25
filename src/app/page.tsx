import { createAdminClient } from "@/lib/supabase/admin";
import { CreateNotebookButton } from "@/components/CreateNotebookButton";
import { NotebookList } from "@/components/NotebookList";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createAdminClient();
  const { data: notebooks } = await supabase
    .from("notebooks")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notebooks</h1>
        <CreateNotebookButton />
      </div>

      {!notebooks || notebooks.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Noch kein Notebook vorhanden. Lege eines an, um Quellen hochzuladen.
        </p>
      ) : (
        <NotebookList notebooks={notebooks} />
      )}
    </main>
  );
}
