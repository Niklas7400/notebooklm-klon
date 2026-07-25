import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateNotebookButton } from "@/components/CreateNotebookButton";

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
        <ul className="flex flex-col gap-2">
          {notebooks.map((nb) => (
            <li key={nb.id}>
              <Link
                href={`/notebook/${nb.id}`}
                className="block rounded-md border border-neutral-200 px-4 py-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                <span className="font-medium">{nb.title}</span>
                {nb.is_demo && (
                  <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    Demo
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
