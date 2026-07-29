# Projekt: NotebookLM-Klon

@AGENTS.md

## Kontext
Bewerbungsaufgabe für Everlast Consulting GmbH. Ziel ist ein funktionierender Klon von NotebookLM (https://notebooklm.google.com), der zeigt, dass ich sauber priorisieren und eine RAG-Architektur (Retrieval-Augmented Generation) umsetzen kann. Umfang und Struktur sind bewusst frei wählbar — dieses Dokument definiert den Scope, den ich mir dafür gesetzt habe.

Zeitrahmen: eine Woche, aber kein Vollzeitpensum — realistisch ca. 1–3h an Wochentagen, mehr Zeit am Wochenende. Dadurch etwas mehr Spielraum als bei einem reinen Wochenendprojekt, z. B. für zusätzliche Nice-to-have-Features und gründlicheres Testen.

## Ziel der App
Eine Web-App, mit der man:
1. Ein "Notebook" anlegt
2. Mehrere Quellen hochlädt (PDF, eingefügter Freitext)
3. Diese Quellen als durchsuchbare Wissensbasis nutzt
4. Fragen dazu stellt und Antworten bekommt, die auf konkrete Quellstellen verweisen (Zitate)
5. Bei jedem Upload automatisch eine aktuelle Zusammenfassung ("Notebook Guide") erhält (wird neu erzeugt, sobald eine weitere Quelle dazukommt — nicht nur beim allerersten Upload, sonst wirkt sie nach der zweiten Quelle veraltet)
6. Optional einen **Audio Overview** generieren kann — ein Zwei-Stimmen-Podcast-Gespräch über die Notebook-Inhalte (bewusst priorisiert, weil Everlast Voice Agents als eines ihrer Aushängeschilder führt — genau dieses Feature wegzulassen wäre strategisch ungeschickt)

## Tech-Stack (verbindlich, bitte nicht abweichen ohne Rücksprache)
- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS
- **PDF-Parsing:** `unpdf` (bevorzugt) oder `pdf-parse`
- **Chunking:** LangChain.js `RecursiveCharacterTextSplitter`, alternativ eine einfache selbstgeschriebene Funktion (max. ~500 Tokens pro Chunk, etwas Overlap)
- **Embeddings:** Voyage AI API, Modell `voyage-4-lite` (Nachfolgegeneration von `voyage-3.x`; einzige Modelle mit 200 Mio. Freitokens pro Account, `voyage-3.x` hat kein Freikontingent mehr. Default-Dimension 1024, passt zum Schema unten. `voyage-4-lite` gewählt statt `voyage-4`, weil höheres Batch-Token-Limit pro Request (1M statt 320K) und niedrigere Kosten — für ein Demo-Projekt wichtiger als die etwas höhere Retrieval-Qualität von `voyage-4`/`voyage-4-large`). Bei Requests immer `input_type: "query"` bzw. `"document"` setzen — verbessert die Trefferqualität messbar. **Wichtig:** Ohne hinterlegte Zahlungsmethode liegen die Rate-Limits bei 3 RPM/10K TPM — praktisch nicht entwicklungstauglich. Zahlungsmethode am besten direkt an Tag 1 hinterlegen (Freitokens bleiben trotzdem erhalten). **Reranking (nachträglich ergänzt):** gleicher Account/Key, Modell `rerank-2-lite` — Cross-Encoder-Reranking des `match_chunks`-Kandidaten-Pools vor dem Prompt-Bau, siehe Chat/RAG-Flow Schritt 5a unten.
- **Vektor-Speicher:** Supabase (Postgres + `pgvector`-Extension) — **Supabase JS Client verwenden (REST-basiert)**, keine direkte Postgres-Connection, wegen Connection-Limits in Vercel Serverless Functions
- **Chat-LLM:** Groq API (OpenAI-kompatible Chat-Completions-API) — Modell `llama-3.3-70b-versatile` für Chat-Antworten und Zusammenfassung, `llama-3.1-8b-instant` für den schnellen Query-Rewriting-Call. Echter Free-Tier ohne Kreditkarte, mir ist keine EU-Einschränkung bekannt (anders als Googles Gemini-Free-Tier, der für Nutzer in EU/EWR/UK/Schweiz zwingend den kostenpflichtigen Modus voraussetzt — für ein Projekt mit Beteiligten in Deutschland relevant). Rate-Limits ca. 30 Anfragen/Min. und niedrig- bis mittel-vierstellig/Tag je Modell — für ein Demo-Projekt ausreichend. Modell-Strings ins README und `.env.example` schreiben; das Free-Modell-Lineup bei Groq ist stabiler als bei Aggregatoren wie OpenRouter, kann sich aber grundsätzlich ändern. **Fallback-Modell (nachträglich ergänzt):** Beim Testen zeigte sich, dass `llama-3.3-70b-versatile` sein Tages-Token-Limit (TPD, Free Tier) bei intensivem Gebrauch tatsächlich erreichen kann — vorher inkonsistent sichtbar: je nachdem, an welcher Stelle im Flow (Skript-Generierung vs. TTS-Synthese) etwas scheiterte, bekam der Nutzer entweder den rohen Groq-Fehler oder eine nichtssagende Sammelmeldung zu sehen. Jetzt einheitlich: Ein 429 des Hauptmodells löst automatisch einen Retry mit `llama-3.1-8b-instant` (separat limitiert) aus, inkl. sichtbarem Hinweis im UI ("Antwort mit Ausweichmodell erstellt"). Gilt für alle Groq-gestützten Features (Chat, Zusammenfassung, Study Guide, Mind Map, Audio-Skript) — ein zentraler Mechanismus in `lib/groq.ts`/`lib/modelFallback.ts` statt Einzellösungen pro Feature. Schlagen auch TTS-Zeilen fehl (z. B. Google-Cloud-Kontingent/Auth-Problem), zeigt die Audio-Overview-Fehlermeldung jetzt die konkrete Ursache statt eines generischen Texts.
- **Text-to-Speech (für Audio Overview):** Google Cloud Text-to-Speech API — Free Tier ca. 1 Mio. Zeichen/Monat, deutlich mehr Puffer als ElevenLabs (nur 10.000 Zeichen/Monat im Free Tier, zusätzlich Wasserzeichen auf der Ausgabe). Groq selbst bietet zwar TTS an (PlayAI Dialog), aber nur kostenpflichtig ($50/1 Mio. Zeichen, kein Free Tier) — deswegen hierfür ein separater Anbieter. Erfordert ein eigenes Google-Cloud-Projekt mit aktivierter Cloud-TTS-API und hinterlegter Zahlungsmethode (wird innerhalb des Freikontingents nicht belastet). Zwei unterschiedliche Stimmen für die zwei Podcast-Hosts (ursprünglich `de-DE-Wavenet-F`/`-B`, nachträglich auf `de-DE-Chirp3-HD-Kore`/`-Charon` umgestellt — WaveNet sprach englische Fachbegriffe im sonst deutschen Skript mit deutscher Phonetik aus, Chirp3-HD handhabt das robuster; live gegen die echte API verifiziert). Bekannte Restgrenze: auch Chirp3-HD ist nicht perfekt bei Code-Switching, siehe README "Bekannte Grenzen" — Geminis natives Multi-Speaker-TTS wäre der nächste Schritt, hängt aber an einem separaten AI-Studio-Prepay-Konto statt am allgemeinen Cloud-Guthaben und wurde deshalb nicht verfolgt.
- **Deployment:** Vercel, verbunden mit GitHub-Repo für Auto-Deploy bei jedem Push

## Scope

### Must-Have (MVP — das muss am Ende funktionieren)
- [ ] Notebook anlegen, löschen; Quelle löschen; Chat zurücksetzen (Cascade-Constraints im Schema sind schon vorbereitet)
- [ ] Quellen hochladen: PDF + eingefügter Text
- [ ] Text-Extraktion → Chunking → Embeddings → Speicherung in Supabase/pgvector
- [ ] Chat-Interface: Frage stellen, RAG-Antwort bekommen
- [ ] Antworten enthalten Zitat-Verweise mit kurzen lokalen IDs im Format `[chunk:1]`, `[chunk:2]` … (nicht die volle UUID — LLMs vertippen sich bei langen IDs und erfinden dann welche), serverseitig auf die echten Chunk-IDs zurückgemappt, klickbar → zeigt den referenzierten Ausschnitt in der Sidebar
- [ ] Automatische Zusammenfassung bei jedem Upload neu erzeugt (nicht nur beim ersten), **persistent gespeichert** (nicht nur einmalig in der UI angezeigt — sonst weg nach Reload, oder veraltet nach der zweiten Quelle)
- [ ] Chatverlauf wird beim erneuten Öffnen eines Notebooks aus `messages` geladen und im UI angezeigt (sonst wirkt es wie ein Bug, wenn er nach Reload leer ist)
- [ ] Chat in einem leeren Notebook (noch keine Quelle hochgeladen) zeigt einen Hinweis ("Lade zuerst eine Quelle hoch"), statt Embedding/Suche ins Leere zu schicken
- [ ] Row Level Security auf allen Supabase-Tabellen aktiv, alle DB-Zugriffe laufen serverseitig über den Service-Role-Key — der `ANON_KEY` landet im Client-Bundle und darf ohne RLS nicht lese-/schreibfähig auf die DB sein
- [ ] Das vorbefüllte Demo-Notebook lässt sich nicht versehentlich über die Löschen-Funktion entfernen (sonst sieht der nächste Reviewer eine leere App)

### Nice-to-have (in dieser Reihenfolge — Audio Overview ist bewusst vor die ursprünglichen Punkte 1/3 gerutscht, siehe Begründung oben)
1. Streaming-Antworten im Chat (statt auf einmal)
2. Audio Overview — Zwei-Stimmen-Podcast-Gespräch (eigener Tag 8, ausführlicher Workflow unten)

### Zusätzliche Verbesserungen für Tag 5 (hoher Wert, geringer Aufwand — ersetzen das gestrichene Notizen-Feature)
- Quellen-Auswahl per Checkbox (nur ausgewählte Quellen befragen — zentrales NotebookLM-Feature, technisch nur ein zusätzlicher `source_ids`-Parameter in `match_chunks`)
- URL als Quelle (fetch + HTML-Text extrahieren) — macht die Demo deutlich zugänglicher als "erst ein PDF suchen müssen"
- Vorbefülltes Demo-Notebook mit 2 Quellen, das beim Öffnen des Live-Links sofort da ist — vermutlich der höchste Wirkungsgrad im ganzen Plan, weil ein Reviewer nur wenige Minuten Zeit hat
- Passwortschutz fürs Deployment via **Middleware-Passwort-Gate** (Vercel Deployment Protection scheidet aus: Password Protection gibt es nur auf Enterprise oder als $150-Add-on für Pro; die kostenlose Hobby-Variante "Vercel Authentication" schützt nur Preview-URLs, nicht die Produktions-Domain, und erlaubt zudem nur einen externen Nutzer pro Account — für HR + Abteilungsleiter zu eng) — mit Groq als kostenlosem Chat-LLM geht es nicht mehr um Geld, sondern darum, dass fremde Besucher oder Crawler-Bots das tägliche Free-Tier-Kontingent verbrauchen, bevor der Reviewer die App testet; bleibt trotzdem empfehlenswert, weil der Aufwand gering ist
- 3–4 kleine Unit-Tests (Chunker, Zitat-Parser, Leertext-Validierung) — geringer Aufwand, signalisiert Sorgfalt

Optional, falls doch noch Zeit übrig ist (spontan am Ende entscheiden, z. B. nach Tag 8): Mehrere Notebooks parallel verwalten, Study-Guide- / FAQ-Generator als Button, Notebook umbenennen, Klick auf Quelle zeigt Volltext/Zusammenfassung der Quelle, vorgeschlagene Einstiegsfragen nach Upload.

### Explizit NICHT umsetzen (bewusste Scope-Entscheidung)
- Video Overview / Sharing / "Discover Sources" — weitere NotebookLM-Features, die für den Zeitrahmen bewusst außen vor bleiben
- Pixelgenaues Highlighting im PDF-Viewer — reicht, wenn der referenzierte Textausschnitt angezeigt wird
- Multi-User-Auth/Rechteverwaltung — Deployment ist einzelner (passwortgeschützter) Demo-Zugang, keine Nutzerverwaltung nötig

> **Mind Map (nachträglich doch umgesetzt):** stand hier ursprünglich ebenfalls unter "bewusst ausgelassen", wurde aber nachträglich ergänzt. Groq generiert eine verschachtelte Markdown-Gliederung (gleiches robustes Format wie beim Study Guide, kein strenges JSON-Format-Risiko), [Markmap](https://markmap.js.org/) (`markmap-lib` + `markmap-view`) rendert daraus clientseitig eine interaktive, zoom-/pannbare Mind Map -- die Baum-Layout-Arbeit übernimmt die Bibliothek. Persistiert in `notebooks.mind_map`, on-demand generierbar wie Study Guide/Audio Overview, in der "Generieren"-Sidebar mit Vorschau + Vollbild-Dialog (die 25%-Sidebar ist für eine breit gefächerte Mind Map zu schmal, daher der Dialog für die eigentliche Ansicht).

> Diese Liste gehört so auch ins README — bei "Umfang frei wählbar" ist die Begründung der Auslassungen genauso Teil der Bewertung wie die Features selbst.

## Datenmodell (Supabase / Postgres)

```sql
create table notebooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text, -- persistente Zusammenfassung, sonst nach Reload weg
  is_demo boolean not null default false, -- schützt das vorbefüllte Demo-Notebook vor Löschen (Guard in der Delete-Route)
  audio_script jsonb, -- [{ speaker: 'A'|'B', text: '...' }, ...] — Podcast-Skript
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
  embedding vector(1024), -- Dimension an voyage-4-lite anpassen (Default 1024)
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
-- Der NEXT_PUBLIC_SUPABASE_ANON_KEY landet im Client-Bundle. Ohne RLS könnte
-- damit jeder direkt auf die Tabellen zugreifen. Alle DB-Zugriffe laufen daher
-- ausschließlich serverseitig über den SUPABASE_SERVICE_ROLE_KEY (in API-Routen),
-- der Anon-Key wird im Frontend gar nicht für DB-Zugriffe verwendet.
alter table notebooks enable row level security;
alter table sources enable row level security;
alter table chunks enable row level security;
alter table messages enable row level security;

-- Index für die Ähnlichkeitssuche. Bei Demo-Datenmengen performance-technisch
-- irrelevant (Postgres scannt auch ohne Index schnell genug), aber Standard-Praxis
-- und wird von jedem technischen Reviewer erwartet — daher trotzdem anlegen
-- und im README kurz begründen, warum er bei dieser Größe nicht nötig wäre.
create index on chunks using hnsw (embedding vector_cosine_ops);

-- match_chunks läuft als SECURITY INVOKER, RLS greift also auch beim Aufruf
-- über den Anon-Key (der ohnehin nirgends im Code verwendet wird). Trotzdem
-- explizit machen statt sich auf RLS allein zu verlassen:
-- Achtung: Postgres vergibt EXECUTE beim Anlegen einer Funktion automatisch an
-- PUBLIC, und jede Rolle (auch anon) ist implizit Mitglied von PUBLIC -- ohne
-- den Revoke von PUBLIC bliebe der Aufruf ueber den Anon-Key trotzdem moeglich.
revoke execute on function match_chunks(vector, uuid, int, uuid[]) from public, anon, authenticated;
```

**Wichtig:** Der Supabase JS Client (REST-basiert) kann den `<=>`-Operator nicht direkt aufrufen. Dafür braucht es eine Postgres-Funktion, die über `supabase.rpc()` angesprochen wird:

```sql
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
```

Aufruf aus der Next.js API-Route:
```js
const { data } = await supabase.rpc('match_chunks', {
  query_embedding: questionEmbedding,
  match_notebook_id: notebookId,
  match_count: 6,
  match_source_ids: selectedSourceIds ?? null // nur gesetzt, wenn Checkbox-Feature aktiv
});
```

Für den MVP reicht `match_source_ids: null` (alle Quellen durchsuchen); der Parameter ist nur für das Tag-5-Feature "Quellen-Auswahl per Checkbox" relevant. Zusätzlich empfiehlt sich ein Similarity-Threshold auf Anwendungsseite: Treffer mit `similarity < 0.3` verwerfen, bevor sie in den Prompt wandern — sonst liefert die Suche bei völlig themenfremden Fragen trotzdem 6 (schwache) Treffer, und die Prompt-Regel "sag explizit, wenn es nicht in den Quellen steht" greift praktisch nie.

## Kern-Workflows

### 1. Upload-Flow
1. Datei/Text kommt über Upload-Formular rein
2. Text extrahieren (PDF → Text via `unpdf`)
3. **Validierung:** Ist der extrahierte Text leer oder extrem kurz (z. B. < 50 Zeichen)? → Abbrechen, klare Fehlermeldung ("Kein Text erkannt — evtl. gescanntes PDF ohne OCR-Layer"). Wichtig, weil PDF-Parser bei reinen Bild-PDFs oft keinen Fehler werfen, sondern stillschweigend einen leeren String liefern.
4. In `sources`-Tabelle speichern
5. Chunking durchführen (Hinweis: `RecursiveCharacterTextSplitter` zählt Zeichen, nicht Tokens — "~500 Tokens" entspricht ca. 1.800–2.000 Zeichen Chunk-Größe)
6. Embeddings für **alle Chunks in einem Batch-Request** an Voyage AI holen (`input_type: "document"`, max. 1.000 Inputs/Request bzw. 1M Tokens bei `voyage-4-lite` — bei sehr langen PDFs in Batches à ~500 Chunks aufteilen), in `chunks` speichern
7. Response an Frontend zurückgeben ("Upload erfolgreich")
8. **Erst danach**, als separater Request vom Frontend ausgelöst: Zusammenfassungs-Request an Groq schicken (`llama-3.3-70b-versatile`, alle Quellen des Notebooks bzw. deren erste N Chunks — nicht nur die gerade hochgeladene), Ergebnis in `notebooks.summary` **überschreiben** und in der UI anzeigen. Bei jedem Upload neu ausführen, nicht nur beim ersten — sonst wirkt der Guide nach der zweiten Quelle veraltet.

> Hintergrund: Schritte 1–7 in einem synchronen Request zu bündeln birgt bei mehrseitigen PDFs Timeout-Risiko (Vercel Hobby-Tier: 10s Standard, per `maxDuration` erweiterbar auf max. 60s; Pro-Tier: 300s). Batch-Embeddings + das Entkoppeln des Summary-Calls hält die Upload-Route in der Praxis unter diesem Limit. Im App Router wird `maxDuration` nicht in `vercel.json` gesetzt, sondern direkt in der Route-Datei exportiert:
> ```ts
> // app/api/upload/route.ts
> export const maxDuration = 60; // Sekunden
> export const dynamic = 'force-dynamic';
> ```
>
> Zusätzlich zu beachten: Vercel-Functions haben ein Request-Payload-Limit von 4,5 MB. Bei größeren PDFs würde der Upload sonst mit einem 413-Fehler abbrechen. Für dieses Projekt reicht es, das im Hinterkopf zu behalten (typische Demo-PDFs bleiben meist deutlich darunter) — falls es doch zum Problem wird: `unpdf` läuft auch im Browser, sodass die Text-Extraktion clientseitig passieren kann und nur der (viel kleinere) reine Text ans Backend geschickt wird, statt der ganzen PDF-Datei.

### 2. Chat/RAG-Flow
0. **Guard:** Hat das Notebook noch keine Quellen? → Direkt antworten ("Lade zuerst eine Quelle hoch"), ohne Embedding/Suche auszulösen.
1. User stellt Frage
2. Letzte 3–5 Nachrichten des Notebooks aus `messages` laden (für Kontext bei Folgefragen)
3. **Frage ggf. umschreiben:** Bei Folgefragen (z. B. "Und was sagt der Autor dazu?") ist die rohe Frage für die Ähnlichkeitssuche wertlos, weil ihr der Bezug fehlt. Kurzer, schneller Groq-Call mit einem leichten Modell (`llama-3.1-8b-instant`) formt Frage + letzte Nachrichten zu einer eigenständigen Suchanfrage um. Diese umgeschriebene Version wird embedded, nicht die Originalfrage. **Nur bei vorhandenem Verlauf** — bei der allerersten Nachricht eines Notebooks gibt es nichts umzuschreiben, diesen Call einfach überspringen (spart einen unnötigen Hop vor dem ersten Token).
4. Embedding der (ggf. umgeschriebenen) Frage berechnen (Voyage AI, `input_type: "query"`)
5. Ähnlichkeitssuche via `match_chunks`-RPC (breiterer Kandidaten-Pool von 30 Treffern statt nur der finalen 5–8, gefiltert auf `notebook_id`); Treffer mit `similarity < 0.3` verwerfen
5a. **Reranking (nachträglich ergänzt, über den ursprünglichen Tag-4-Plan hinaus):** Die 30 Kandidaten gehen zusammen mit der Frage an Voyage AIs `rerank-2-lite` (Cross-Encoder, bewertet Frage und Chunk-Text gemeinsam statt nur über die Distanz zweier unabhängig berechneter Embeddings) und werden auf die finalen 8 Treffer für den Prompt verdichtet. Skaliert unabhängig von der Notebook-Größe, weil der HNSW-Index immer nur diesen konstanten 30er-Pool liefert, nie den gesamten Chunk-Bestand — dadurch bleibt die Retrieval-Qualität auch bei großen Notebooks mit vielen thematisch ähnlichen Chunks hoch. Bei ≤ 8 Kandidaten entfällt der Rerank-Call ganz; schlägt er fehl (Rate-Limit, Netzwerk), fällt die Suche auf die reine Vektorsuche-Reihenfolge zurück, statt die Chat-Antwort scheitern zu lassen.
6. Groq-API-Call zusammenbauen (`llama-3.3-70b-versatile`, OpenAI-kompatible Chat-Completions-API): System-Prompt mit den gefundenen Chunks (jeweils mit lokaler Kurz-ID `1, 2, 3, …` statt UUID) + `messages`-Array mit den geladenen Verlauf-Nachrichten (abwechselnd role: user/assistant) + neue (Original-)Frage als letzter User-Turn
7. Antwort mit `[chunk:N]`-Zitat-Markierungen parsen, `N` gegen die lokale Kurz-ID-Zuordnung auf die echte Chunk-UUID zurückmappen (kein zusätzlicher DB-Call nötig, da die Zuordnung schon aus Schritt 5 bekannt ist) und rendern
8. Frage + Antwort (inkl. aufgelöster Zitate mit echten Chunk-IDs) in `messages` speichern — **auch beim Streaming** (Tag 6): erst nach Streamende die vollständige Assistant-Nachricht inkl. aufgelöster Zitate persistieren, sonst ist der Verlauf nach einem Reload halb leer, obwohl das Streaming selbst einwandfrei lief.

> Beim Öffnen eines bestehenden Notebooks: alle `messages` des Notebooks laden und im Chat-UI anzeigen (nicht nur beim Senden einer neuen Frage) — sonst wirkt der Chat nach einem Reload wie zurückgesetzt.

### 3. System-Prompt-Vorlage für RAG
```
Du bist ein Assistent, der ausschließlich auf Basis der bereitgestellten Quellenausschnitte antwortet.

Regeln:
- Beantworte die Frage nur mit Informationen aus den folgenden Ausschnitten.
- Wenn die Antwort nicht in den Ausschnitten enthalten ist, sage das explizit.
- Markiere jede Aussage mit einem Verweis auf die Nummer des Ausschnitts im Format [chunk:N], direkt hinter der Aussage.
- Verwende ausschließlich Nummern, die unten aufgeführt sind. Erfinde keine Nummern.
- Antworte in der Sprache, in der die Frage gestellt wurde (nicht zwingend Deutsch).

Quellenausschnitte:
{{#each chunks}}
[chunk:{{this.localId}}] (Quelle: {{this.filename}})
{{this.content}}
{{/each}}
```

`localId` ist eine fortlaufende Nummer (1, 2, 3, …) innerhalb dieser Antwort — keine Datenbank-UUID. Kurze Nummern statt langer UUIDs, weil Modelle sich bei UUIDs im Output leicht vertippen oder welche erfinden; die Zuordnung `localId → echte Chunk-ID` ist serverseitig ohnehin schon aus der `match_chunks`-Antwort bekannt und muss nicht neu abgefragt werden.

Die Konversationshistorie (aus Schritt 2 des Chat/RAG-Flows) wird **nicht** in diesen System-Prompt gepackt, sondern als eigene Turns im `messages`-Array des Groq-API-Calls übergeben (role: `user`/`assistant` abwechselnd, neue Frage als letzter `user`-Turn). Das nutzt die native Multi-Turn-Struktur der (OpenAI-kompatiblen) API, statt Verlauf als Blocktext in den Prompt zu quetschen.

**Hinweis zur Zitat-Zuverlässigkeit:** Open-Source-Modelle wie Llama halten sich in der Praxis etwas weniger konsistent an strikte Ausgabeformate als Claude. Beim Testen (Tag 4/5) gezielt prüfen, ob `[chunk:N]` zuverlässig im richtigen Format kommt; falls nicht, Prompt nachschärfen (z. B. ein Kurzbeispiel im System-Prompt ergänzen) oder das Parsing tolerant gegenüber kleinen Abweichungen gestalten (z. B. `chunk: N` ohne Klammer auch akzeptieren).

### 4. Audio-Overview-Flow (Tag 8)
1. User klickt "Audio Overview generieren" im Notebook — **on-demand, nicht automatisch bei jedem Upload** (anders als die Text-Zusammenfassung), weil TTS im Gegensatz zu Groq ein begrenztes Zeichen-Freikontingent hat und nicht bei jedem Upload unbemerkt verbraucht werden soll
2. **Skript-Generierung:** Groq (`llama-3.3-70b-versatile`) bekommt die Notebook-Zusammenfassung + zentrale Chunks als Kontext, generiert ein lockeres Zwei-Personen-Dialog-Skript (Host A / Host B) als strukturiertes JSON (`[{ speaker: "A"|"B", text: "..." }, ...]`); Prompt gibt Länge/Ton vor (z. B. "3–5 Minuten, locker, für Laien verständlich, greift die Kerninhalte der Quellen auf")
3. Pro Skript-Zeile ein TTS-Call an Google Cloud TTS mit der jeweiligen Sprecher-Stimme (Host A / Host B = zwei unterschiedliche Stimmen); Audio-Clip nach Supabase Storage hochladen
4. Skript + geordnetes Array der Clip-URLs in `notebooks.audio_script` / `notebooks.audio_clip_urls` speichern, `audio_status = 'ready'`
5. Player im Frontend spielt Clips **sequenziell** ab — kein Server-seitiges Audio-Zusammenschneiden nötig, der nächste Clip startet automatisch über das `onended`-Event des `<audio>`-Elements — und zeigt an, welcher Host gerade spricht

> Fehlerbehandlung: Falls ein einzelner TTS-Call fehlschlägt (Rate-Limit, Netzwerkfehler), diesen Turn überspringen bzw. einmal erneut versuchen, statt den ganzen Flow abzubrechen — sonst scheitert ein 10-Zeilen-Gespräch komplett an einem einzigen fehlgeschlagenen Call. `audio_status = 'failed'` nur setzen, wenn wirklich nichts brauchbares generiert wurde.

## Schritt-für-Schritt-Bauplan (verteilt auf gut eine Woche — 7 Kern-Tage + Tag 8 für Audio Overview, moderates Tagespensum)

**Tag 1 — Setup**
- Next.js-Projekt mit TypeScript + Tailwind initialisieren
- GitHub-Repo anlegen, mit Vercel verbinden (Auto-Deploy testen mit "Hello World")
- Supabase-Projekt anlegen, `pgvector`-Extension aktivieren, Schema (inkl. `is_demo`-Flag, HNSW-Index, `revoke execute` für `match_chunks`) + `match_chunks`-Funktion oben anlegen, RLS auf allen Tabellen aktivieren
- Voyage-AI-Account anlegen, Zahlungsmethode hinterlegen (sonst nur 3 RPM/10K TPM — praktisch nicht entwicklungstauglich; Freitokens bleiben trotzdem erhalten)
- Groq-Account anlegen (console.groq.com, kein Kreditkarte nötig), API-Key erzeugen
- `.env.local` mit allen Keys anlegen, `.env.example` ohne Werte ins Repo
- `maxDuration` für die Upload-Route direkt in `app/api/upload/route.ts` exportieren, auf 60s setzen (Hobby-Tier-Maximum)
- Früh prüfen, ob sich die Claude-Code-Session tatsächlich exportieren lässt — falls nicht, parallel ein Loom aufnehmen, statt das erst am Ende festzustellen

**Tag 2 — Ingestion (Teil 1)**
- Grundlayout bauen: Sidebar (Quellenliste) + Hauptbereich (Chat)
- Upload-Endpoint (PDF + Text), Text-Extraktion
- Validierung: leerer/zu kurzer extrahierter Text → verständliche Fehlermeldung statt stiller leerer Chunks

**Tag 3 — Ingestion (Teil 2)**
- Chunking-Logik
- Embedding-Erzeugung als **Batch-Request** (alle Chunks einer Quelle in einem Voyage-AI-Call) + Speicherung in Supabase
- Manuell prüfen: Datei hochladen → Chunks + Embeddings sind in der DB, Upload-Route bleibt deutlich unter dem Timeout-Limit

**Tag 4 — RAG-Chat**
- `match_chunks`-RPC aus der API-Route aufrufen (Ähnlichkeitssuche, Similarity-Threshold anwenden)
- Laden der letzten 3–5 Nachrichten des Notebooks für Konversationskontext
- Query-Rewriting für Folgefragen (kurzer Groq-Call mit `llama-3.1-8b-instant`, der Frage + Verlauf zu einer eigenständigen Suchanfrage umformt, bevor embedded wird; bei der ersten Nachricht eines Notebooks überspringen, da kein Verlauf existiert)
- Chat-API-Route mit Groq (`llama-3.3-70b-versatile`): `messages`-Array aus Verlauf + neuer Frage, System-Prompt mit Kurz-ID-Zitaten wie oben
- Chat-UI: Frage eingeben, Antwort mit klickbaren Zitaten anzeigen; beim Öffnen eines Notebooks gespeicherten Chatverlauf laden und anzeigen

**Tag 5 — Polish & hoher-Wert-Bundle**
> ⚠️ Zeitbudget-Check: Dieses Bundle ist realistisch eher ein halber bis ganzer Tag (~6–8h), nicht 1–3h. Entweder den Wochenstart so legen, dass Tag 5 & 6 aufs Wochenende fallen (z. B. Start Di/Mi), oder falls die Zeit an diesem Tag nicht reicht: URL-Quelle und Unit-Tests nach hinten in den Tag-7-Puffer schieben. Löschen, Checkbox-Auswahl, Demo-Notebook und Passwortschutz sind die vier Punkte mit dem höchsten Wirkungsgrad — die haben Vorrang.
- Automatische Zusammenfassung: separater Request vom Frontend, ausgelöst sobald Upload-Response zurück ist, bei **jedem** Upload neu erzeugt (nicht nur beim ersten), Ergebnis in `notebooks.summary` gespeichert (nicht im selben Request wie die Ingestion)
- Löschen-Funktionalität: Quelle löschen, Notebook löschen, Chat zurücksetzen (Cascade-Constraints sind im Schema schon vorbereitet) — Guard einbauen, der das `is_demo`-Notebook vor dem Löschen schützt
- Quellen-Auswahl per Checkbox (nutzt den `match_source_ids`-Parameter der RPC)
- Vorbefülltes Demo-Notebook mit 2 Quellen für den Live-Link (`is_demo = true` setzen)
- Passwortschutz fürs Deployment via Middleware-Passwort-Gate (kein Vercel-Add-on nötig)
- *Falls Zeit reicht, sonst auf Tag 7:* URL als Quelle (fetch + HTML-Text extrahieren); 3–4 kleine Unit-Tests (Chunker, Zitat-Parser, Leertext-Validierung)
- Ladezustände, Fehlerbehandlung (leere/zu kurze Uploads, zu große Dateien, API-Fehler)
- MVP noch mal komplett durchtesten (Upload → Chat → Zitate → Folgefragen mit Kontextbezug → Löschen → Reload)

**Tag 6 — Nice-to-have: Streaming**
- Streaming-Antworten im Chat (Achtung: `[chunk:N]`-Marker kommen beim Streaming fragmentiert an — Parser muss inkrementell tolerant sein oder Zitate erst nach Streamende auflösen; **wichtig**: die vollständige Assistant-Nachricht inkl. aufgelöster Zitate muss nach Streamende trotzdem in `messages` geschrieben werden, sonst ist der Chatverlauf nach einem Reload halb leer)
- Falls noch Puffer: URL-Quelle oder Unit-Tests (falls von Tag 5 verschoben)

**Tag 7 — Deployment, Doku & Puffer**
- Finales Deployment auf Vercel prüfen (Live-Test, nicht nur lokal!)
- Kurzer Responsive-Check (der Reviewer öffnet den Link eventuell am Handy)
- README schreiben: Setup-Anleitung, Architektur in 2–3 Sätzen, bewusste Scope-Entscheidungen (inkl. Liste der bewusst ausgelassenen Features), Abschnitt "Bekannte Grenzen" (kein OCR für gescannte PDFs, keine Hybrid-Suche, keine Mandantentrennung). Reranking war hier ursprünglich als bewusst ausgelassener "nächster Qualitätsschritt" vorgesehen, wurde aber nachträglich doch umgesetzt (Voyage `rerank-2-lite`, siehe Chat/RAG-Flow Schritt 5a) — vor allem wegen der Skalierbarkeit bei großen Notebooks, bei denen reine Kosinus-Distanz mehrere ähnlich nahe, aber unterschiedlich relevante Treffer liefert.
- Environment Variables in Vercel-Dashboard eintragen
- Puffer für Bugs, die typischerweise erst beim Live-Deployment auftauchen

**Tag 8 — Audio Overview (Bonus, strategisch relevant für Everlast als Voice-Agent-Anbieter)**
- Google-Cloud-Projekt anlegen, Cloud-TTS-API aktivieren, API-Key erzeugen
- Skript-Generierungs-Prompt bauen und mit 2–3 Notebooks testen (Ton, Länge, sauber parsbare JSON-Struktur)
- TTS-Integration: pro Skript-Zeile Audio generieren, in Supabase Storage ablegen, Clip-URLs + Skript speichern
- Player-UI: sequenzielle Wiedergabe, Anzeige welcher Host gerade spricht, Ladezustand während der Generierung (kann je nach Skriptlänge mehrere Sekunden bis über eine Minute dauern)
- Fehlerbehandlung für einzelne fehlgeschlagene TTS-Calls (siehe Workflow oben)
- Kurz gegentesten: reicht das Google-Cloud-Freikontingent für mehrfaches Generieren während Entwicklung + Review-Phase locker aus (ja, ~1 Mio. Zeichen/Monat vs. wenige Tausend pro Generierung)
- Falls am Ende noch Zeit: Mehrere Notebooks parallel verwalten oder Study-Guide-Button (siehe "Optional" oben)

## Benötigte Environment Variables
```
GROQ_API_KEY=
VOYAGE_API_KEY=
GOOGLE_CLOUD_TTS_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Abgabe-Anforderungen (nicht vergessen!)
- Link zum GitHub-Repo
- Link zum Live-Deployment (Vercel)
- Claude Code Agent Session (diese Session selbst, als Nachweis für den Ablauf) — alternativ ein Loom-Video. Wichtig: Das ist nur das Bau-Werkzeug (Stichwort "Nutzung von AI-Tools ausdrücklich erwünscht"), unabhängig davon, dass die App selbst zur Laufzeit Groq statt Claude als Chat-LLM nutzt.
- In der Antwortmail: das Passwort fürs Deployment mitschicken plus ein Satz, dass das Demo-Notebook vorbefüllt ist und man direkt Fragen stellen kann — der Reviewer soll nicht raten müssen, was zu tun ist

## Definition of Done
- [ ] Notebook mit mindestens 2 Quellen anlegbar
- [ ] Chat beantwortet Fragen korrekt aus den Quellen
- [ ] Zitate sind sichtbar und nachvollziehbar
- [ ] Zusammenfassung erscheint automatisch nach Upload und bleibt nach Reload erhalten
- [ ] Chatverlauf bleibt nach Reload sichtbar
- [ ] Folgefragen funktionieren mit echtem Kontextbezug (nicht nur bei expliziter Wiederholung des Themas)
- [ ] Quelle/Notebook lassen sich löschen
- [ ] RLS ist auf allen Tabellen aktiv, DB-Zugriffe laufen nur serverseitig
- [ ] Demo-Deployment ist gegen unautorisierten Zugriff geschützt
- [ ] Live-Deployment funktioniert (nicht nur lokal getestet)
- [ ] README ist vollständig und verständlich
