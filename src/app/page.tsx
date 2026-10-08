import { createAdminClient } from "@/lib/supabase/admin";
import { NotebooksHome } from "@/components/NotebooksHome";
import { formatRelativeDate, truncate } from "@/lib/format";

export const dynamic = "force-dynamic";

const EXCERPT_LENGTH = 100;

// Der Supabase-Client kann die eingebettete "sources(count)"-Aggregation
// nicht aus dem handgepflegten Database-Typ (types.ts) ableiten, da dafuer
// die Relationships-Metadaten eines vollstaendig generierten Schemas noetig
// waeren -- daher hier ein lokaler Typ statt Kampf mit den Generics.
type NotebookWithSourceCount = {
  id: string;
  title: string;
  is_demo: boolean;
  summary: string | null;
  created_at: string;
  sources: { count: number }[];
};

export default async function Home() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notebooks")
    .select("id, title, is_demo, summary, created_at, sources(count)")
    .order("created_at", { ascending: false });

  const notebooks = (data ?? []) as unknown as NotebookWithSourceCount[];

  const cards = notebooks.map((nb) => ({
    id: nb.id,
    title: nb.title,
    isDemo: nb.is_demo,
    excerpt: nb.summary ? truncate(nb.summary, EXCERPT_LENGTH) : "Noch keine Quellen hochgeladen.",
    sourceCount: nb.sources?.[0]?.count ?? 0,
    relDate: formatRelativeDate(nb.created_at),
  }));

  return <NotebooksHome initialNotebooks={cards} />;
}
