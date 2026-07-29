# NotebookLM-Klon

Ein funktionierender Klon von [NotebookLM](https://notebooklm.google.com), gebaut als Bewerbungsaufgabe für Everlast Consulting GmbH. Ziel war zu zeigen, dass ich eine RAG-Architektur (Retrieval-Augmented Generation) sauber umsetzen und dabei den Umfang eines Ein-Wochen-Projekts realistisch priorisieren kann.

## Was die App kann

1. Notebooks anlegen und löschen
2. Quellen hochladen: PDF, eingefügter Text, **URL** (Fetch + HTML-Text-Extraktion); Quellen einzeln wieder löschen, linke Quellen-Sidebar einklappbar
3. Quellen werden automatisch in Chunks zerlegt, embedded und in einer Vektordatenbank durchsuchbar gemacht; ein nachgeschaltetes Cross-Encoder-Reranking verdichtet einen breiteren Kandidaten-Pool auf die relevantesten Treffer für den Prompt (skaliert unabhängig von der Notebook-Größe, siehe Architektur)
4. Chat mit **Streaming-Antworten**, die auf konkrete Quellstellen verweisen: klickbare Zitat-Nummern im Text zeigen den referenzierten Ausschnitt unten im Chat *und* klappen die zugehörige Quelle links auf, mit farblich hervorgehobener zitierter Stelle im Volltext; nach jeder Antwort werden 2–3 passende, an den tatsächlichen Quellenausschnitten verankerte Folgefragen vorgeschlagen
5. Bei jedem Upload — und nach jedem Löschen einer Quelle — wird automatisch eine aktuelle Zusammenfassung ("Notebook Guide") erzeugt und persistent gespeichert — einklappbar in der Sidebar
6. Quellen-Auswahl per Checkbox (nur ausgewählte Quellen befragen)
7. Chatverlauf bleibt nach einem Reload erhalten, Chat lässt sich zurücksetzen
8. Ein vorbefülltes Demo-Notebook ist beim Öffnen des Live-Links sofort verfügbar
9. **Audio Overview**: auf Knopfdruck ein Zwei-Stimmen-Podcast-Gespräch über die Notebook-Inhalte generieren (Groq für das Skript, Google Cloud TTS für die Sprachausgabe, sequenzielle Wiedergabe im Player)
10. **Mind Map**: auf Knopfdruck eine interaktive, zoom-/pannbare Mind Map der Notebook-Inhalte generieren (Groq für die Markdown-Gliederung, [Markmap](https://markmap.js.org/) fürs Rendering im Browser), mit Vorschau in der Sidebar und Vollbild-Ansicht

## Architektur

Next.js (App Router) als Frontend und API-Layer in einem, Supabase/Postgres mit `pgvector` als Vektordatenbank, Voyage AI für Embeddings und Reranking und Groq (Llama 3.3 70B, OpenAI-kompatible API) als Chat-LLM. Alle DB-Zugriffe laufen serverseitig über den Supabase Service-Role-Key; der Anon-Key wird im Client-Bundle nie für Datenzugriffe verwendet. Der RAG-Flow ist klassisch zweiphasig: Ingestion (Text extrahieren → chunken → embedden → speichern) und Retrieval (Frage embedden → Ähnlichkeitssuche via `match_chunks`-RPC liefert einen breiteren Kandidaten-Pool → Cross-Encoder-Reranking verdichtet auf die finalen Treffer → Antwort mit lokal nummerierten Zitaten, die serverseitig auf echte Chunk-IDs zurückgemappt werden).

**Reranking im Detail:** Die reine Vektorsuche (`match_chunks`) liefert zunächst 30 statt der finalen 8 Kandidaten. Diese gehen zusammen mit der Frage an Voyage AIs `rerank-2-lite` (Cross-Encoder: bewertet Frage und Chunk-Text gemeinsam statt wie beim Embedding nur über die Distanz zweier unabhängig berechneter Vektoren), das die 8 tatsächlich relevantesten Treffer für den Prompt auswählt. Das lohnt sich vor allem bei großen Notebooks mit vielen thematisch ähnlichen Chunks, wo reine Kosinus-Distanz oft mehrere ähnlich nahe, aber unterschiedlich relevante Treffer liefert. Skaliert dabei unabhängig von der Notebook-Größe: der HNSW-Index liefert die 30 Kandidaten in O(log n) egal ob ein Notebook 50 oder 50.000 Chunks enthält, und das Reranking bewertet danach immer nur diesen konstanten Pool statt des gesamten Chunk-Bestands. Bei kleinen Kandidaten-Mengen (≤ 8 Treffer) entfällt der Rerank-Call ganz; schlägt er fehl (Rate-Limit, Netzwerk), fällt die Suche auf die reine Vektorsuche-Reihenfolge zurück, statt die Chat-Antwort scheitern zu lassen.

## Tech-Stack

| Bereich | Wahl | Warum |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript + Tailwind CSS | Vorgabe |
| PDF-Parsing | [`unpdf`](https://github.com/unjs/unpdf) | Läuft ohne native Abhängigkeiten in Vercel Serverless Functions |
| Chunking | LangChain.js `RecursiveCharacterTextSplitter` | ~1800 Zeichen/Chunk (≈500 Tokens), 200 Zeichen Overlap |
| Embeddings & Reranking | Voyage AI, `voyage-4-lite` (Embeddings) + `rerank-2-lite` (Reranking) | 200 Mio. Freitokens/Account, hohes Batch-Limit (1M Tokens/Request); gleicher Account/Key für beide Modelle |
| Vektor-Speicher | Supabase (Postgres + `pgvector`) | REST-basierter JS-Client statt direkter Postgres-Connection (Connection-Limits in Serverless Functions) |
| Chat-LLM | Groq, `llama-3.3-70b-versatile` (Chat/Zusammenfassung), `llama-3.1-8b-instant` (Query-Rewriting) | Echter Free-Tier ohne Kreditkarte, keine EU-Einschränkung; automatischer Fallback auf `llama-3.1-8b-instant`, falls das Tageslimit von `llama-3.3-70b-versatile` erreicht ist (mit Hinweis im UI) |
| Text-to-Speech | Google Cloud TTS (Chirp3-HD), Stimmen `de-DE-Chirp3-HD-Kore` / `de-DE-Chirp3-HD-Charon` | ~1 Mio. Freizeichen/Monat, zwei unterschiedliche Stimmen für die zwei Podcast-Hosts; Chirp3-HD statt WaveNet wegen deutlich robusterer Aussprache eingebetteter englischer Fachbegriffe (siehe Bekannte Grenzen). Fish Audio (kostenloses Free-Tier-Modell) wurde als Alternative live getestet, aber verworfen — siehe Bekannte Grenzen |
| Mind-Map-Rendering | [Markmap](https://markmap.js.org/) (`markmap-lib` + `markmap-view`) | Nimmt dem LLM die Baum-Layout-Arbeit ab; erwartet als Eingabe eine simple verschachtelte Markdown-Gliederung statt strengem JSON — robusteres LLM-Ausgabeformat |
| Deployment | Vercel | Auto-Deploy bei Push auf `main` |

## Setup

```bash
npm install
cp .env.example .env.local   # Werte eintragen, siehe unten
npm run dev
```

Supabase-Schema einmalig im SQL-Editor ausführen: [`supabase/schema.sql`](supabase/schema.sql) (Tabellen, RLS, HNSW-Index, `match_chunks`-Funktion). Der Storage-Bucket `audio-clips` für Audio-Overview-Clips wird beim ersten Generieren automatisch (public) angelegt, kein manueller Schritt nötig.

### Alternative: mit Docker starten

```bash
cp .env.example .env.local   # Werte eintragen, siehe unten
docker compose up --build
```

App läuft danach unter `http://localhost:3000`. Das Supabase-Schema (siehe oben) muss trotzdem einmalig im SQL-Editor ausgeführt werden — Supabase läuft als gehosteter Cloud-Dienst, nicht als Container in diesem Setup, es gibt also keine lokale Datenbank zum Anlegen. `docker-compose.yml` reicht `.env.local` per `env_file` in den Container durch; alle Variablen sind reiner Server-Runtime-Zugriff (siehe Kommentar in `src/lib/supabase/admin.ts` und "Must-Have"-Punkt zu RLS oben) — auch die `NEXT_PUBLIC_*`-Variablen werden aktuell nirgends im Client-Bundle gelesen, deshalb reichen sie zur Laufzeit und müssen nicht als Docker-Build-Arg übergeben werden. Das mehrstufige `Dockerfile` baut auf Next.js' `output: "standalone"` auf (schlankes Server-Bundle statt vollem `node_modules`-Baum).

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

64 Unit-Tests über 8 Dateien für die reine, von externen APIs unabhängige Logik: Chunker, Zitat-Parser, Leertext-Validierung, HTML-Extraktion für URL-Quellen, RAG-Prompt-/Zitat-Aufbau, relative Datumsanzeige, das Parsen der Audio-Overview-Skript-Antwort, das Entfernen von Codeblock-Wrappern aus der Mind-Map-Markdown-Antwort, das Abtrennen der Folgefragen vom Chat-Antwort-Stream, das Entfernen von Steuerzeichen aus PDF-Text und die Groq-Fallback-Modell-Logik (mit gemocktem `fetch`, ohne echten Netzwerk-Call) — die Stellen, an denen sich Formatannahmen am leichtesten stillschweigend brechen lassen. Funktionen mit echten API-Calls (Groq, Voyage, Google TTS, Supabase) sind ansonsten bewusst nicht unit-getestet, sondern manuell gegen die echte Umgebung verifiziert (siehe Commit-Historie).

## Bewusste Scope-Entscheidungen

Der Umfang war frei wählbar. Umgesetzt wurden, in dieser Priorität:

- **MVP**: Notebooks/Quellen/Chat verwalten, RAG-Chat mit Zitaten, automatische Zusammenfassung, persistenter Chatverlauf, RLS auf allen Tabellen, Guard fürs Demo-Notebook
- **Streaming-Chat-Antworten** — vor Audio Overview, weil es die im MVP schon vorhandene Antwortqualität spürbar verbessert (kein Warten auf den kompletten Text), bevor ein komplett neues Feature dazukommt
- **Quellen-Auswahl per Checkbox, URL-Quelle, vorbefülltes Demo-Notebook, Passwortschutz** — hoher Wirkungsgrad bei geringem Aufwand: ein Reviewer hat typischerweise nur wenige Minuten Zeit, das vorbefüllte Demo-Notebook dürfte davon den größten Unterschied machen
- **Audio Overview** (Zwei-Stimmen-Podcast) bewusst vor die ursprünglich geplanten "Nice-to-have"-Punkte 1 und 3 gezogen, weil Everlast Voice Agents als eines ihrer Aushängeschilder führt — dieses Feature auszulassen wäre strategisch ungeschickt gewesen. On-demand per Button, nicht automatisch bei jedem Upload, weil TTS im Gegensatz zu Groq ein begrenztes Freikontingent hat.
- **Reranking und Mind Map** wurden ursprünglich bewusst ausgelassen (siehe unten), nachträglich aber doch ergänzt — Reranking wegen der Skalierbarkeit bei großen Notebooks, Mind Map als weiterer, mit Markmap technisch günstig umsetzbarer Baustein der RAG-Inhaltsaufbereitung.

**Explizit nicht umgesetzt** (bewusste Entscheidung, kein Zeitmangel-Zufall):

- Video Overview / Sharing / "Discover Sources" — weitere NotebookLM-Features außerhalb des gesetzten Rahmens
- Pixelgenaues Highlighting im PDF-Viewer — der referenzierte Textausschnitt in der Sidebar reicht als Beleg
- Multi-User-Auth/Rechteverwaltung — Deployment ist ein einzelner passwortgeschützter Demo-Zugang, keine Nutzerverwaltung nötig

## Status

Alle Punkte aus MVP, den Tag-5-Erweiterungen, Streaming (Tag 6) und Audio Overview (Tag 8) sind umgesetzt und wurden gegen das echte Live-Deployment getestet — inklusive Fehlerfällen (fehlgeschlagene TTS-Calls, parallele Generierungs-Requests, leeres Notebook).

## Bekannte Grenzen

- **Kein OCR**: Gescannte PDFs ohne Text-Layer liefern leeren Text und werden mit einer klaren Fehlermeldung abgelehnt, statt sie stillschweigend als leere Quelle zu speichern. Betrifft insbesondere ältere, über Dokumentlieferdienste bezogene PDFs (z. B. "ImagePDF"-Producer), die reine Seiten-Scans ohne Text-Layer sind.
- **PDFs mit defekter Ligatur-Kodierung**: Manche (v. a. ältere) PDFs bilden Ligaturen wie "ffi"/"ff" nicht korrekt auf Unicode ab und liefern an dieser Stelle rohe Steuerzeichen statt der eigentlichen Buchstaben (beobachtet: ein NUL-Byte anstelle von "ff" in "Affect"). Ein eingebettetes NUL-Byte hätte den Insert nach Supabase mit einem kryptischen "unsupported Unicode escape sequence"-Fehler scheitern lassen — `extractPdfText` bereinigt daher alle Steuerzeichen außer Tab/Zeilenumbruch/Wagenrücklauf. Die betroffene Ligatur fehlt dadurch im Text (z. B. "Aect" statt "Affect"), was für die Suche/das Chatten vernachlässigbar ist.
- **Keine Hybrid-Suche**: Nur Vektorsuche (plus Reranking, siehe Architektur), keine Kombination mit klassischer Stichwortsuche (BM25 o.ä.) — bei sehr spezifischen Eigennamen/Zahlen kann das reine Embedding-Matching schwächer sein. Nächster naheliegender Qualitätsschritt, wurde für dieses Projekt aber bewusst nicht gebaut.
- **Keine Mandantentrennung**: Alle Notebooks liegen in derselben Tabelle ohne User-Scoping — passend zum Deployment als einzelner Demo-Zugang, nicht für Mehrbenutzerbetrieb gedacht.
- **HTML-Extraktion bei URL-Quellen** ist eine einfache, Regex-basierte Bereinigung (kein Readability-Algorithmus) — bei Seiten mit viel Navigations-/Boilerplate-Text landet dieser mit im extrahierten Text.
- **Open-Source-LLM-Grenzen**: Llama hält sich bei strikten Format-/Verhaltensvorgaben (Zitat-Format, "nur aus den Quellen antworten") in der Praxis etwas weniger zuverlässig an Vorgaben als z. B. Claude — siehe `NOTES.md` für konkret beobachtete Fälle und mögliche Prompt-Verbesserungen.
- **Audio Overview läuft synchron innerhalb eines Requests** (kein Job-Queue-System) — bei sehr langen Skripten könnte das theoretisch an das Vercel-Timeout (60s) stoßen; in Tests mit 10–16 Gesprächszeilen lag die Generierung bei 3–8s. Einzelne fehlgeschlagene TTS-Zeilen werden übersprungen (nach einem Retry), statt den ganzen Flow abzubrechen.
- **TTS-Qualitätsdecke bei Google Cloud TTS**: Die klassische Cloud-Text-to-Speech-API (aktuell `de-DE-Chirp3-HD-*`-Stimmen) spricht englische Fachbegriffe im sonst deutschen Podcast-Skript stellenweise noch mit deutscher Phonetik aus, wenn auch deutlich seltener als mit den ursprünglichen WaveNet-Stimmen. Zwei mögliche nächste Schritte, bewusst nicht umgesetzt, um kein zusätzliches Geld/Setup in ein Nice-to-have-Feature zu stecken: (1) Geminis natives Multi-Speaker-TTS (`gemini-2.5-flash-preview-tts`, ein ganzer Dialog in einem Call statt 12+ Einzel-Calls, bessere Mehrsprachigkeit) läuft über ein separates AI-Studio-Prepay-Konto, unabhängig vom allgemeinen Google-Cloud-Guthaben — bräuchte einen eigenen Top-up. (2) ElevenLabs wurde von vornherein ausgeschlossen (siehe Tech-Stack-Begründung oben). SSML-Feinschliff (`<break>`-Pacing, `speakingRate`-Variation zwischen den Hosts) bliebe als kostenloser, ungenutzter nächster Schritt innerhalb der aktuellen Architektur.
- **Fish Audio als TTS-Alternative geprüft, nicht übernommen**: Live gegen die echte API getestet (kostenloses `s2.1-pro-free`-Modell, laut Anbieter befristet bis 2026-08-31) — funktioniert, inklusive zweier passender deutscher Stimmen für die Podcast-Hosts. Bewusst nicht als Ersatz für Google Cloud TTS übernommen: (1) die Stimmenbibliothek ist ein unkuratierter Community-Marktplatz — in derselben deutschen Trefferliste tauchten auch geschmacklose Charakter-Stimmen auf, eine seriöse Auswahl bräuchte laufende manuelle Prüfung statt eines einmal gesetzten, stabilen Defaults; (2) der kostenlose Zugang ist laut Anbieter explizit befristet und "ohne SLA" für Produktion nicht vorgesehen; (3) Anfragen dürfen laut Anbieter zur Modellverbesserung verwendet werden, anders als bei Google Cloud TTS.

## Datenmodell

Siehe [`supabase/schema.sql`](supabase/schema.sql). Kurzfassung: `notebooks` → `sources` → `chunks` (mit `pgvector`-Embedding), sowie `messages` für den Chatverlauf. Cascade-Deletes auf allen Fremdschlüsseln, Row Level Security auf allen Tabellen aktiv (keine Policies — alle Zugriffe laufen serverseitig über den Service-Role-Key).
