export type AudioStatus = "none" | "generating" | "ready" | "failed";

export type AudioScriptLine = {
  speaker: "A" | "B";
  text: string;
};

export type Citation = {
  local_id: number;
  source_id: string;
  chunk_id: string;
  filename: string;
  snippet: string;
};

export type Notebook = {
  id: string;
  title: string;
  summary: string | null;
  suggested_questions: string[] | null;
  is_demo: boolean;
  audio_script: AudioScriptLine[] | null;
  // Ein einzelner Eintrag ist null, wenn der TTS-Call fuer diese Skript-Zeile
  // trotz Retry fehlgeschlagen ist (siehe audio-Route) -- die Zeile bleibt im
  // Skript/Transkript sichtbar, der Player ueberspringt nur den fehlenden Clip.
  audio_clip_urls: (string | null)[] | null;
  audio_status: AudioStatus;
  created_at: string;
};

export type Source = {
  id: string;
  notebook_id: string;
  filename: string;
  raw_text: string;
  created_at: string;
};

export type Chunk = {
  id: string;
  source_id: string;
  content: string;
  embedding: number[] | null;
  chunk_index: number;
};

export type Message = {
  id: string;
  notebook_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  created_at: string;
};

export type MatchChunkResult = {
  id: string;
  source_id: string;
  filename: string;
  content: string;
  chunk_index: number;
  similarity: number;
};

// Minimaler Database-Typ fuer den typisierten Supabase-Client.
// Kein voll generiertes Schema (kein Supabase-CLI-Zugriff in dieser Umgebung),
// deckt aber alle Tabellen/Spalten ab, die der Code tatsaechlich verwendet.
// Wichtig: als `type`, nicht `interface` -- interfaces erfuellen die
// Record<string, unknown>-Constraints der Supabase-Generics nicht.
export type Database = {
  public: {
    Tables: {
      notebooks: {
        Row: Notebook;
        Insert: Partial<Notebook> & { title: string };
        Update: Partial<Notebook>;
        Relationships: [];
      };
      sources: {
        Row: Source;
        Insert: Partial<Source> & {
          notebook_id: string;
          filename: string;
          raw_text: string;
        };
        Update: Partial<Source>;
        Relationships: [];
      };
      chunks: {
        Row: Chunk;
        Insert: Partial<Chunk> & {
          source_id: string;
          content: string;
          chunk_index: number;
        };
        Update: Partial<Chunk>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Partial<Message> & {
          notebook_id: string;
          role: "user" | "assistant";
          content: string;
        };
        Update: Partial<Message>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_chunks: {
        Args: {
          query_embedding: number[];
          match_notebook_id: string;
          match_count?: number;
          match_source_ids?: string[] | null;
        };
        Returns: MatchChunkResult[];
      };
    };
  };
};
