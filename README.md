# NotebookLM-Klon

Ein funktionierender Klon von [NotebookLM](https://notebooklm.google.com), gebaut als Bewerbungsaufgabe für Everlast Consulting GmbH. Ziel war zu zeigen, dass ich eine RAG-Architektur (Retrieval-Augmented Generation) sauber umsetzen und dabei den Umfang eines Ein-Wochen-Projekts realistisch priorisieren kann.

## Was die App kann

1. Notebooks anlegen und löschen
2. Quellen hochladen: PDF, eingefügter Text, **URL** (Fetch + HTML-Text-Extraktion)
3. Quellen werden automatisch in Chunks zerlegt, embedded und in einer Vektordatenbank durchsuchbar gemacht
4. Chat mit **Streaming-Antworten**, die auf konkrete Quellstellen verweisen (klickbare Zitat-Nummern im Text zeigen den referenzierten Ausschnitt in der Sidebar)
5. Bei jedem Upload wird automatisch eine aktuelle Zusammenfassung ("Notebook Guide") erzeugt und persistent gespeichert — einklappbar in der Sidebar
6. Quellen-Auswahl per Checkbox (nur ausgewählte Quellen befragen)
7. Chatverlauf bleibt nach einem Reload erhalten, Chat lässt sich zurücksetzen
8. Ein vorbefülltes Demo-Notebook ist beim Öffnen des Live-Links sofort verfügbar
9. **Audio Overview**: auf Knopfdruck ein Zwei-Stimmen-Podcast-Gespräch über die Notebook-Inhalte generieren (Groq für das Skript, Google Cloud TTS für die Sprachausgabe, sequenzielle Wiedergabe im Player)

## Architektur

Next.js (App Router) als Frontend und API-Layer in einem, Supabase/Postgres mit `pgvector` als Vektordatenbank, Voyage AI für Embeddings und Groq (Llama 3.3 70B, OpenAI-kompatible API) als Chat-LLM. Alle DB-Zugriffe laufen serverseitig über den Supabase Service-Role-Key; der Anon-Key wird im Client-Bundle nie für Datenzugriffe verwendet. Der RAG-Flow ist klassisch zweiphasig: Ingestion (Text extrahieren → chunken → embedden → speichern) und Retrieval (Frage embedden → Ähnlichkeitssuche via `match_chunks`-RPC → Antwort mit lokal nummerierten Zitaten, die serverseitig auf echte Chunk-IDs zurückgemappt werden).

## Tech-Stack

| Bereich | Wahl | Warum |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript + Tailwind CSS | Vorgabe |
| PDF-Parsing | [`unpdf`](https://github.com/unjs/unpdf) | Läuft ohne native Abhängigkeiten in Vercel Serverless Functions |
| Chunking | LangChain.js `RecursiveCharacterTextSplitter` | ~1800 Zeichen/Chunk (≈500 Tokens), 200 Zeichen Overlap |
| Embeddings | Voyage AI, `voyage-4-lite` | 200 Mio. Freitokens/Account, hohes Batch-Limit (1M Tokens/Request) |
| Vektor-Speicher | Supabase (Postgres + `pgvector`) | REST-basierter JS-Client statt direkter Postgres-Connection (Connection-Limits in Serverless Functions) |
| Chat-LLM | Groq, `llama-3.3-70b-versatile` (Chat/Zusammenfassung), `llama-3.1-8b-instant` (Query-Rewriting) | Echter Free-Tier ohne Kreditkarte, keine EU-Einschränkung |
| Text-to-Speech | Google Cloud TTS (WaveNet), Stimmen `de-DE-Wavenet-F` / `de-DE-Wavenet-B` | ~1 Mio. Freizeichen/Monat, zwei unterschiedliche Stimmen für die zwei Podcast-Hosts |
| Deployment | Vercel | Auto-Deploy bei Push auf `main` |

## Setup

```bash
npm install
cp .env.example .env.local   # Werte eintragen, siehe unten
npm run dev
```

Supabase-Schema einmalig im SQL-Editor ausführen: [`supabase/schema.sql`](supabase/schema.sql) (Tabellen, RLS, HNSW-Index, `match_chunks`-Funktion). Der Storage-Bucket `audio-clips` für Audio-Overview-Clips wird beim ersten Generieren automatisch (public) angelegt, kein manueller Schritt nötig.

### Environment Variables

```
GROQ_API_KEY=                    # console.groq.com
VOYAGE_API_KEY=                  # dash.voyageai.com — Zahlungsmethode hinterlegen, sonst nur 3 RPM/10K TPM
GOOGLE_CLOUD_TTS_API_KEY=        # console.cloud.google.com (Audio Overview)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SITE_PASSWORD=                   # Middleware-Passwort-Gate, leer lassen = kein Schutz
```

### Tests

```bash
npm test
```

11 Unit-Tests für Chunker (`src/lib/chunking.ts`), Zitat-Parser (`src/lib/citations.ts`) und Leertext-Validierung (`src/lib/ingestion.ts`) — die drei Stellen, an denen sich Formatannahmen am leichtesten stillschweigend brechen lassen.

## Bewusste Scope-Entscheidungen

Der Umfang war frei wählbar. Umgesetzt wurden, in dieser Priorität:

- **MVP**: Notebooks/Quellen/Chat verwalten, RAG-Chat mit Zitaten, automatische Zusammenfassung, persistenter Chatverlauf, RLS auf allen Tabellen, Guard fürs Demo-Notebook
- **Streaming-Chat-Antworten** — vor Audio Overview, weil es die im MVP schon vorhandene Antwortqualität spürbar verbessert (kein Warten auf den kompletten Text), bevor ein komplett neues Feature dazukommt
- **Quellen-Auswahl per Checkbox, URL-Quelle, vorbefülltes Demo-Notebook, Passwortschutz** — hoher Wirkungsgrad bei geringem Aufwand: ein Reviewer hat typischerweise nur wenige Minuten Zeit, das vorbefüllte Demo-Notebook dürfte davon den größten Unterschied machen
- **Audio Overview** (Zwei-Stimmen-Podcast) bewusst vor die ursprünglich geplanten "Nice-to-have"-Punkte 1 und 3 gezogen, weil Everlast Voice Agents als eines ihrer Aushängeschilder führt — dieses Feature auszulassen wäre strategisch ungeschickt gewesen. On-demand per Button, nicht automatisch bei jedem Upload, weil TTS im Gegensatz zu Groq ein begrenztes Freikontingent hat.

**Explizit nicht umgesetzt** (bewusste Entscheidung, kein Zeitmangel-Zufall):

- Mind Map / Video Overview / Sharing / "Discover Sources" — weitere NotebookLM-Features außerhalb des gesetzten Rahmens
- Pixelgenaues Highlighting im PDF-Viewer — der referenzierte Textausschnitt in der Sidebar reicht als Beleg
- Multi-User-Auth/Rechteverwaltung — Deployment ist ein einzelner passwortgeschützter Demo-Zugang, keine Nutzerverwaltung nötig

## Status

Alle Punkte aus MVP, den Tag-5-Erweiterungen, Streaming (Tag 6) und Audio Overview (Tag 8) sind umgesetzt und wurden gegen das echte Live-Deployment getestet — inklusive Fehlerfällen (fehlgeschlagene TTS-Calls, parallele Generierungs-Requests, leeres Notebook).

## Bekannte Grenzen

- **Kein OCR**: Gescannte PDFs ohne Text-Layer liefern leeren Text und werden mit einer klaren Fehlermeldung abgelehnt, statt sie stillschweigend als leere Quelle zu speichern.
- **Kein Reranking**: Die Ähnlichkeitssuche liefert die Top-K-Treffer nach Kosinus-Distanz direkt an das LLM weiter, ohne einen zweiten, genaueren Relevanz-Schritt. Nächster naheliegender Qualitätsschritt, wurde für dieses Projekt aber bewusst nicht gebaut.
- **Keine Hybrid-Suche**: Nur Vektorsuche, keine Kombination mit klassischer Stichwortsuche (BM25 o.ä.) — bei sehr spezifischen Eigennamen/Zahlen kann das reine Embedding-Matching schwächer sein.
- **Keine Mandantentrennung**: Alle Notebooks liegen in derselben Tabelle ohne User-Scoping — passend zum Deployment als einzelner Demo-Zugang, nicht für Mehrbenutzerbetrieb gedacht.
- **HTML-Extraktion bei URL-Quellen** ist eine einfache, Regex-basierte Bereinigung (kein Readability-Algorithmus) — bei Seiten mit viel Navigations-/Boilerplate-Text landet dieser mit im extrahierten Text.
- **Open-Source-LLM-Grenzen**: Llama hält sich bei strikten Format-/Verhaltensvorgaben (Zitat-Format, "nur aus den Quellen antworten") in der Praxis etwas weniger zuverlässig an Vorgaben als z. B. Claude — siehe `NOTES.md` für konkret beobachtete Fälle und mögliche Prompt-Verbesserungen.
- **Audio Overview läuft synchron innerhalb eines Requests** (kein Job-Queue-System) — bei sehr langen Skripten könnte das theoretisch an das Vercel-Timeout (60s) stoßen; in Tests mit 10–16 Gesprächszeilen lag die Generierung bei 3–8s. Einzelne fehlgeschlagene TTS-Zeilen werden übersprungen (nach einem Retry), statt den ganzen Flow abzubrechen.

## Datenmodell

Siehe [`supabase/schema.sql`](supabase/schema.sql). Kurzfassung: `notebooks` → `sources` → `chunks` (mit `pgvector`-Embedding), sowie `messages` für den Chatverlauf. Cascade-Deletes auf allen Fremdschlüsseln, Row Level Security auf allen Tabellen aktiv (keine Policies — alle Zugriffe laufen serverseitig über den Service-Role-Key).
