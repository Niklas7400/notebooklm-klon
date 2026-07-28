-- NotebookLM-Klon: Schema fuer Supabase (Postgres + pgvector)
-- In den Supabase SQL Editor einfuegen und ausfuehren (Tag 1).
-- pgvector-Extension muss vorher unter Database > Extensions aktiviert sein.

create extension if not exists vector;

create table notebooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text, -- persistente Zusammenfassung, sonst nach Reload weg
  suggested_questions jsonb, -- string[] vorgeschlagener Einstiegsfragen, sonst nach Reload/Notebook-Wechsel weg
  study_guide text, -- zuletzt generierter Study Guide & FAQ, sonst nach Reload weg
  is_demo boolean not null default false, -- schuetzt das vorbefuellte Demo-Notebook vor Loeschen (Guard in der Delete-Route)
  audio_script jsonb, -- [{ speaker: 'A'|'B', text: '...' }, ...] -- Podcast-Skript
  audio_clip_urls jsonb, -- geordnetes Array von Supabase-Storage-URLs, ein Clip pro Skript-Zeile
  audio_status text default 'none', -- 'none' | 'generating' | 'ready' | 'failed'
  created_at timestamptz default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid references notebooks(id) on delete cascade,
  filename text not null,
  raw_text text not null,
  created_at timestamptz default now()
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete cascade,
  content text not null,
  embedding vector(1024), -- Dimension an voyage-4-lite angepasst (Default 1024)
  chunk_index int not null
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid references notebooks(id) on delete cascade,
  role text not null, -- 'user' | 'assistant'
  content text not null,
  citations jsonb, -- z.B. [{ source_id, chunk_id, snippet }]
  created_at timestamptz default now()
);

-- Row Level Security aktivieren, aber keine Policies anlegen:
-- Der NEXT_PUBLIC_SUPABASE_ANON_KEY landet im Client-Bundle. Ohne RLS koennte
-- damit jeder direkt auf die Tabellen zugreifen. Alle DB-Zugriffe laufen daher
-- ausschliesslich serverseitig ueber den SUPABASE_SERVICE_ROLE_KEY (in API-Routen),
-- der Anon-Key wird im Frontend gar nicht fuer DB-Zugriffe verwendet.
alter table notebooks enable row level security;
alter table sources enable row level security;
alter table chunks enable row level security;
alter table messages enable row level security;

-- Index fuer die Aehnlichkeitssuche. Bei Demo-Datenmengen performance-technisch
-- irrelevant (Postgres scannt auch ohne Index schnell genug), aber Standard-Praxis
-- und wird von jedem technischen Reviewer erwartet -- daher trotzdem anlegen
-- und im README kurz begruenden, warum er bei dieser Groesse nicht noetig waere.
create index on chunks using hnsw (embedding vector_cosine_ops);

create or replace function match_chunks (
  query_embedding vector(1024),
  match_notebook_id uuid,
  match_count int default 6,
  match_source_ids uuid[] default null -- optional: nur diese Quellen durchsuchen (Checkbox-Auswahl)
)
returns table (
  id uuid,
  source_id uuid,
  filename text,
  content text,
  chunk_index int,
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.source_id,
    sources.filename,
    chunks.content,
    chunks.chunk_index,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  join sources on sources.id = chunks.source_id
  where sources.notebook_id = match_notebook_id
    and (match_source_ids is null or chunks.source_id = any(match_source_ids))
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- match_chunks laeuft als SECURITY INVOKER, RLS greift also auch beim Aufruf
-- ueber den Anon-Key (der ohnehin nirgends im Code verwendet wird). Trotzdem
-- explizit machen statt sich auf RLS allein zu verlassen. Wichtig: Postgres
-- vergibt EXECUTE beim Anlegen einer Funktion automatisch an die Pseudo-Rolle
-- PUBLIC, und jede Rolle (auch anon) ist implizit Mitglied von PUBLIC -- ohne
-- den expliziten Revoke von PUBLIC bliebe der Aufruf ueber anon trotzdem moeglich.
revoke execute on function match_chunks(vector, uuid, int, uuid[]) from public, anon, authenticated;
