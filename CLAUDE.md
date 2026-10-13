# Projekt: NotebookLM-Klon

@AGENTS.md

## Kontext
Portfolio-Projekt: ein funktionierender Nachbau von NotebookLM (https://notebooklm.google.com), der eine saubere RAG-Architektur (Retrieval-Augmented Generation) zeigt. Der Umfang ist bewusst begrenzt; dieses Dokument hält die verbindlichen Entscheidungen und Abläufe fest.

## Funktionsumfang
1. Notebooks anlegen, umbenennen, löschen; Quellen hochladen (PDF, eingefügter Text, URL) und einzeln löschen; Chat zurücksetzen
2. Quellen werden extrahiert, gechunkt, embedded und in Supabase/pgvector durchsuchbar gemacht
3. Chat mit Streaming-Antworten und Zitat-Verweisen im Format `[chunk:N]` (kurze lokale IDs, serverseitig auf echte Chunk-IDs zurückgemappt); ein Klick klappt die Quelle in der Sidebar auf und hebt die zitierte Stelle hervor
4. Quellen-Auswahl per Checkbox (`match_source_ids` der RPC), Chatverlauf persistent, Hinweis im leeren Notebook statt Suche ins Leere
5. Zusammenfassung ("Notebook Guide") wird bei jedem Upload und nach jedem Löschen einer Quelle neu erzeugt und persistent gespeichert
6. On-demand: Audio Overview (Zwei-Stimmen-Podcast), Study Guide, Mind Map
7. Vorbefülltes Demo-Notebook (`is_demo = true`), das sich nicht über die Löschen-Funktion entfernen lässt (Guard in der Delete-Route)
8. Passwortschutz per Middleware-Passwort-Gate (`src/proxy.ts`, `SITE_PASSWORD`); Vercel Deployment Protection scheidet aus (Password Protection nur Enterprise/kostenpflichtiges Add-on, "Vercel Authentication" schützt nur Preview-URLs). Zweck: fremde Besucher oder Crawler sollen das tägliche Groq-Free-Tier-Kontingent nicht verbrauchen

Bewusst **nicht** umgesetzt: Video Overview, Sharing, "Discover Sources", pixelgenaues Highlighting im gerenderten PDF (es gibt nur die extrahierte Volltext-Ansicht, die zitierte Stelle wird dort trotzdem markiert), Multi-User-Auth/Rechteverwaltung.

## Qualitätschecks
`npm test` (Vitest), `npm run lint`, `npm run build` — alle drei sollen vor dem Pushen grün sein.

## Tech-Stack (verbindlich, bitte nicht abweichen ohne Rücksprache)
- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS
- **PDF-Parsing:** `unpdf` (bevorzugt) oder `pdf-parse`. **Nachträglich ergänzt:** Manche (v. a. ältere) PDFs bilden Ligaturen wie "ffi"/"ff" nicht korrekt auf Unicode ab und liefern dort rohe Steuerzeichen statt Buchstaben (beobachtet: ein eingebettetes NUL-Byte anstelle von "ff"). Das ließ den Insert nach Supabase mit einem kryptischen "unsupported Unicode escape sequence"-Fehler scheitern — `extractPdfText` entfernt daher alle Steuerzeichen außer Tab/Zeilenumbruch/Wagenrücklauf, bevor der Text gespeichert wird.
- **Chunking:** LangChain.js `RecursiveCharacterTextSplitter`, alternativ eine einfache selbstgeschriebene Funktion (max. ~500 Tokens pro Chunk, etwas Overlap)
- **Embeddings:** Voyage AI API, Modell `voyage-4-lite` (Nachfolgegeneration von `voyage-3.x`; einzige Modelle mit 200 Mio. Freitokens pro Account, `voyage-3.x` hat kein Freikontingent mehr. Default-Dimension 1024, passt zum Schema unten. `voyage-4-lite` gewählt statt `voyage-4`, weil höheres Batch-Token-Limit pro Request (1M statt 320K) und niedrigere Kosten — für ein Demo-Projekt wichtiger als die etwas höhere Retrieval-Qualität von `voyage-4`/`voyage-4-large`). Bei Requests immer `input_type: "query"` bzw. `"document"` setzen — verbessert die Trefferqualität messbar. **Wichtig:** Ohne hinterlegte Zahlungsmethode liegen die Rate-Limits bei 3 RPM/10K TPM — praktisch nicht entwicklungstauglich. Zahlungsmethode am besten direkt beim Einrichten hinterlegen (Freitokens bleiben trotzdem erhalten). **Reranking (nachträglich ergänzt):** gleicher Account/Key, Modell `rerank-2-lite` — Cross-Encoder-Reranking des `match_chunks`-Kandidaten-Pools vor dem Prompt-Bau, siehe Chat/RAG-Flow Schritt 5a unten.
- **Vektor-Speicher:** Supabase (Postgres + `pgvector`-Extension) — **Supabase JS Client verwenden (REST-basiert)**, keine direkte Postgres-Connection, wegen Connection-Limits in Vercel Serverless Functions
- **Chat-LLM:** Groq API (OpenAI-kompatible Chat-Completions-API) — Modell `llama-3.3-70b-versatile` für Chat-Antworten und Zusammenfassung, `llama-3.1-8b-instant` für den schnellen Query-Rewriting-Call. Echter Free-Tier ohne Kreditkarte, mir ist keine EU-Einschränkung bekannt (anders als Googles Gemini-Free-Tier, der für Nutzer in EU/EWR/UK/Schweiz zwingend den kostenpflichtigen Modus voraussetzt — für ein Projekt mit Beteiligten in Deutschland relevant). Rate-Limits ca. 30 Anfragen/Min. und niedrig- bis mittel-vierstellig/Tag je Modell — für ein Demo-Projekt ausreichend. Modell-Strings ins README und `.env.example` schreiben; das Free-Modell-Lineup bei Groq ist stabiler als bei Aggregatoren wie OpenRouter, kann sich aber grundsätzlich ändern. **Fallback-Modell (nachträglich ergänzt):** Beim Testen zeigte sich, dass `llama-3.3-70b-versatile` sein Tages-Token-Limit (TPD, Free Tier) bei intensivem Gebrauch tatsächlich erreichen kann — vorher inkonsistent sichtbar: je nachdem, an welcher Stelle im Flow (Skript-Generierung vs. TTS-Synthese) etwas scheiterte, bekam der Nutzer entweder den rohen Groq-Fehler oder eine nichtssagende Sammelmeldung zu sehen. Jetzt einheitlich: Ein 429 des Hauptmodells löst automatisch einen Retry mit `llama-3.1-8b-instant` (separat limitiert) aus, inkl. sichtbarem Hinweis im UI ("Antwort mit Ausweichmodell erstellt"). Gilt für alle Groq-gestützten Features (Chat, Zusammenfassung, Study Guide, Mind Map, Audio-Skript) — ein zentraler Mechanismus in `lib/groq.ts`/`lib/modelFallback.ts` statt Einzellösungen pro Feature. Schlagen auch TTS-Zeilen fehl (z. B. Google-Cloud-Kontingent/Auth-Problem), zeigt die Audio-Overview-Fehlermeldung jetzt die konkrete Ursache statt eines generischen Texts.
- **Text-to-Speech (für Audio Overview):** Google Cloud Text-to-Speech API — Free Tier ca. 1 Mio. Zeichen/Monat, deutlich mehr Puffer als ElevenLabs (nur 10.000 Zeichen/Monat im Free Tier, zusätzlich Wasserzeichen auf der Ausgabe). Groq selbst bietet zwar TTS an (PlayAI Dialog), aber nur kostenpflichtig ($50/1 Mio. Zeichen, kein Free Tier) — deswegen hierfür ein separater Anbieter. Erfordert ein eigenes Google-Cloud-Projekt mit aktivierter Cloud-TTS-API und hinterlegter Zahlungsmethode (wird innerhalb des Freikontingents nicht belastet). Zwei unterschiedliche Stimmen für die zwei Podcast-Hosts (ursprünglich `de-DE-Wavenet-F`/`-B`, nachträglich auf `de-DE-Chirp3-HD-Kore`/`-Charon` umgestellt — WaveNet sprach englische Fachbegriffe im sonst deutschen Skript mit deutscher Phonetik aus, Chirp3-HD handhabt das robuster; live gegen die echte API verifiziert). Bekannte Restgrenze: auch Chirp3-HD ist nicht perfekt bei Code-Switching, siehe README "Bekannte Grenzen" — Geminis natives Multi-Speaker-TTS wäre der nächste Schritt, hängt aber an einem separaten AI-Studio-Prepay-Konto statt am allgemeinen Cloud-Guthaben und wurde deshalb nicht verfolgt. **Alternative geprüft, verworfen:** Fish Audio (kostenloses `s2.1-pro-free`-Modell, befristet bis 2026-08-31) live getestet — API funktioniert, zwei passende deutsche Stimmen gefunden und gegengehört. Nicht übernommen, weil (1) die Stimmenbibliothek ein offener Community-Marktplatz ohne Kuratierung ist (in derselben deutschen Trefferliste tauchten z. B. geschmacklose Charakter-Stimmen auf — Auswahl bräuchte laufende manuelle Prüfung statt eines einmal getroffenen, stabilen Defaults), (2) der Free-Zugang laut Anbieter explizit befristet und für Produktion nicht gedacht ist ("kein SLA"), und (3) Requests laut AGB zur Modellverbesserung verwendet werden dürfen — bei Google Cloud TTS gibt es diese Klausel nicht.
- **Deployment:** Vercel, verbunden mit GitHub-Repo für Auto-Deploy bei jedem Push. **Nachträglich ergänzt:** zusätzlich ein Docker-Setup (`Dockerfile` + `docker-compose.yml`) für den lokalen Start ohne Node-Installation — baut auf Next.js' `output: "standalone"` auf, Supabase bleibt dabei der gehostete Cloud-Dienst (kein DB-Container), alle Keys kommen per `env_file` aus `.env.local`.

## Datenmodell (Supabase / Postgres)
Schema und `match_chunks`-Funktion stehen in `supabase/schema.sql` (Tabellen `notebooks`, `sources`, `chunks`, `messages`; Cascade-Deletes auf allen Fremdschlüsseln). Verbindliche Regeln:

- Row Level Security ist auf allen Tabellen aktiv, **ohne Policies**. Der `NEXT_PUBLIC_SUPABASE_ANON_KEY` landet im Client-Bundle und darf nichts lesen oder schreiben können; alle DB-Zugriffe laufen serverseitig in API-Routen über den `SUPABASE_SERVICE_ROLE_KEY`.
- `match_chunks` ist per `revoke execute ... from public, anon, authenticated` abgesichert (Postgres vergibt EXECUTE automatisch an PUBLIC, und jede Rolle ist implizit Mitglied von PUBLIC).
- Der Supabase JS Client (REST) kann den `<=>`-Operator nicht direkt aufrufen, daher der Zugriff über `supabase.rpc('match_chunks', { query_embedding, match_notebook_id, match_count, match_source_ids })`; `match_source_ids: null` durchsucht alle Quellen.
- Embedding-Dimension 1024 (passend zu `voyage-4-lite`), HNSW-Index mit `vector_cosine_ops` — bei Demo-Datenmengen performance-technisch nicht nötig, aber Standard-Praxis.
- Auf Anwendungsseite werden Treffer mit `similarity < 0.3` verworfen, sonst liefert die Suche bei themenfremden Fragen trotzdem schwache Treffer, und die Prompt-Regel "sage explizit, wenn es nicht in den Quellen steht" greift praktisch nie.

## Kern-Workflows

### 1. Upload-Flow
1. Datei/Text kommt über Upload-Formular rein
2. Text extrahieren (PDF → Text via `unpdf`)
3. **Validierung:** Ist der extrahierte Text leer oder extrem kurz (z. B. < 50 Zeichen)? → Abbrechen, klare Fehlermeldung ("Kein Text erkannt — evtl. gescanntes PDF ohne OCR-Layer"). Wichtig, weil PDF-Parser bei reinen Bild-PDFs oft keinen Fehler werfen, sondern stillschweigend einen leeren String liefern.
4. In `sources`-Tabelle speichern
5. Chunking durchführen (Hinweis: `RecursiveCharacterTextSplitter` zählt Zeichen, nicht Tokens — "~500 Tokens" entspricht ca. 1.800–2.000 Zeichen Chunk-Größe). **Nachträglich abgewichen:** tatsächlich umgesetzt mit 900 Zeichen / 150 Overlap — 1800er-Chunks bündelten beim Test an einem echten 24-seitigen PDF mehrere thematisch verschiedene Punkte, wodurch der angezeigte Zitat-Ausschnitt viel mehr Kontext zeigte als für die belegte Aussage nötig (Begründung steht auch im Code, `lib/chunking.ts`).
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
8. Frage + Antwort (inkl. aufgelöster Zitate mit echten Chunk-IDs) in `messages` speichern — **auch beim Streaming**: erst nach Streamende die vollständige Assistant-Nachricht inkl. aufgelöster Zitate persistieren, sonst ist der Verlauf nach einem Reload halb leer, obwohl das Streaming selbst einwandfrei lief.

> Beim Öffnen eines bestehenden Notebooks: alle `messages` des Notebooks laden und im Chat-UI anzeigen (nicht nur beim Senden einer neuen Frage) — sonst wirkt der Chat nach einem Reload wie zurückgesetzt.

> **Folgefragen-Grounding (nachträglich ergänzt):** Die vorgeschlagenen Folgefragen wurden ursprünglich nur aus Frage + Antworttext generiert, nie aus den tatsächlich gefundenen Chunks. Das fiel besonders nach dem Modell-Fallback auf `llama-3.1-8b-instant` auf (schwächeres Modell, konnte den fehlenden Kontext schlechter kompensieren) und führte zu Folgefragen, die die Quellen gar nicht beantworten können. Root Cause war unabhängig vom Fallback-Modell selbst: Der Prompt bekam einfach zu wenig Kontext. Fix: `sourceContext` (die vollen Chunk-Inhalte aus Schritt 5) wird jetzt zusätzlich in den Folgefragen-Prompt gegeben, plus ein `hasCitation`-Heuristik-Guard, der die Folgefragen-Generierung ganz überspringt, wenn die Antwort selbst kein `[chunk:N]`-Zitat enthält (typisch für Ablehnungsantworten "steht nicht in den Quellen").

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

**Hinweis zur Zitat-Zuverlässigkeit:** Open-Source-Modelle wie Llama halten sich in der Praxis etwas weniger konsistent an strikte Ausgabeformate als Claude. Beim Testen gezielt prüfen, ob `[chunk:N]` zuverlässig im richtigen Format kommt; falls nicht, Prompt nachschärfen (z. B. ein Kurzbeispiel im System-Prompt ergänzen) oder das Parsing tolerant gegenüber kleinen Abweichungen gestalten (z. B. `chunk: N` ohne Klammer auch akzeptieren).

### 4. Audio-Overview-Flow
1. User klickt "Audio Overview generieren" im Notebook — **on-demand, nicht automatisch bei jedem Upload** (anders als die Text-Zusammenfassung), weil TTS im Gegensatz zu Groq ein begrenztes Zeichen-Freikontingent hat und nicht bei jedem Upload unbemerkt verbraucht werden soll
2. **Skript-Generierung:** Groq (`llama-3.3-70b-versatile`) bekommt die Notebook-Zusammenfassung + zentrale Chunks als Kontext, generiert ein lockeres Zwei-Personen-Dialog-Skript (Host A / Host B) als strukturiertes JSON (`[{ speaker: "A"|"B", text: "..." }, ...]`); Prompt gibt Länge/Ton vor (z. B. "3–5 Minuten, locker, für Laien verständlich, greift die Kerninhalte der Quellen auf")
3. Pro Skript-Zeile ein TTS-Call an Google Cloud TTS mit der jeweiligen Sprecher-Stimme (Host A / Host B = zwei unterschiedliche Stimmen); Audio-Clip nach Supabase Storage hochladen
4. Skript + geordnetes Array der Clip-URLs in `notebooks.audio_script` / `notebooks.audio_clip_urls` speichern, `audio_status = 'ready'`
5. Player im Frontend spielt Clips **sequenziell** ab — kein Server-seitiges Audio-Zusammenschneiden nötig, der nächste Clip startet automatisch über das `onended`-Event des `<audio>`-Elements — und zeigt an, welcher Host gerade spricht

> Fehlerbehandlung: Falls ein einzelner TTS-Call fehlschlägt (Rate-Limit, Netzwerkfehler), diesen Turn überspringen bzw. einmal erneut versuchen, statt den ganzen Flow abzubrechen — sonst scheitert ein 10-Zeilen-Gespräch komplett an einem einzigen fehlgeschlagenen Call. `audio_status = 'failed'` nur setzen, wenn wirklich nichts brauchbares generiert wurde.

## Benötigte Environment Variables
```
GROQ_API_KEY=
VOYAGE_API_KEY=
GOOGLE_CLOUD_TTS_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SITE_PASSWORD=   # optional; leer = kein Passwortschutz
```
