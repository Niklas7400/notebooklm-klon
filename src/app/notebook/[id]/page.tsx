import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { UploadForm } from "@/components/UploadForm";

export const dynamic = "force-dynamic";

export default async function NotebookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: notebook }, { data: sources }] = await Promise.all([
    supabase.from("notebooks").select("*").eq("id", id).single(),
    supabase
      .from("sources")
      .select("id, filename, created_at")
      .eq("notebook_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!notebook) notFound();

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-72 shrink-0 flex-col gap-4 border-r border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <Link href="/" className="text-xs text-neutral-500 hover:underline">
            ← Notebooks
          </Link>
          <h1 className="mt-1 truncate text-lg font-semibold">{notebook.title}</h1>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Quellen
          </h2>
          {!sources || sources.length === 0 ? (
            <p className="text-xs text-neutral-500">Noch keine Quelle hochgeladen.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="truncate rounded border border-neutral-200 px-2 py-1.5 text-xs dark:border-neutral-800"
                  title={s.filename}
                >
                  {s.filename}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Quelle hinzufügen
          </h2>
          <UploadForm notebookId={notebook.id} />
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center p-8">
        {!sources || sources.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Lade zuerst eine Quelle hoch, um Fragen stellen zu können.
          </p>
        ) : (
          <p className="text-sm text-neutral-500">Chat folgt in Kürze.</p>
        )}
      </main>
    </div>
  );
}
