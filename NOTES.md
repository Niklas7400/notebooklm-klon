# Notizen für spätere Änderungen

Ideen/Beobachtungen, die während der Entwicklung aufgefallen sind, aber
bewusst nicht sofort umgesetzt wurden (Zeitrahmen, kein akuter Bug).

## Chunk-Größe für präziseres Zitieren verkleinern

Aktuell: `CHUNK_SIZE = 1800` / `CHUNK_OVERLAP = 200` in `src/lib/chunking.ts`
(~500 Tokens, wie in CLAUDE.md vorgegeben).

Beobachtung beim Testen mit einem echten 24-seitigen PDF: Ein einzelner
Chunk kann mehrere thematisch unterschiedliche Aufzählungspunkte enthalten
(z. B. eine ganze Liste von Bewertungskriterien in einem Chunk). Die
Zitat-Zuordnung ist dadurch korrekt auf Chunk-Ebene, aber nicht auf
Satz-/Punkt-Ebene — der referenzierte Ausschnitt in der Sidebar zeigt dann
mehr Kontext, als für die konkrete Aussage nötig wäre.

Mögliche Verbesserung: kleinere Chunks (z. B. 800–1000 Zeichen) für
feinere Zitat-Granularität testen. Trade-off: mehr Chunks pro Quelle →
mehr Embedding-Calls beim Upload, potenziell mehr (kleinere) Treffer in
`match_chunks`, die den Kontext für das Chat-LLM stärker fragmentieren
könnten. Vor einer Umstellung mit echten Dokumenten gegentesten, ob die
Antwortqualität darunter leidet.

## Zusammenfassungs-Prompt liefert manchmal zwei Varianten statt einer

Beobachtet beim Testen (Tag 5): Der Summary-Prompt in
`summarizeSources()` (`src/lib/groq.ts`) sagt "3-6 Sätze **oder** kurze
Bullet Points". Llama hat das mindestens einmal als "biete beides an"
interpretiert und einen Fließtext-Absatz plus direkt danach eine
redundante Bullet-Point-Version derselben Aussagen ausgegeben
("Alternativ können auch folgende Bullet-Punkte verwendet werden: ...").
Ergebnis: eine unnötig lange, sich wiederholende Zusammenfassung in der
Sidebar.

Mögliche Verbesserung: Prompt eindeutiger machen (nur ein Format fest
vorgeben, z. B. ausschließlich Bullet Points, kein "oder"), ggf. mit
einem Kurzbeispiel wie beim Zitat-Format. Gleiches Muster wie das
erfundene `[chunk:8]` weiter oben -- Llama haelt sich bei mehrdeutigen
Formatvorgaben weniger zuverlaessig an eine einzige Variante.

## Modell haelt sich nicht immer an "nur aus den Quellen antworten"

Beobachtet beim Testen (Tag 5, Checkbox-Feature): Bei einer Frage, zu
der die ausgewählten Quellen keine Antwort enthalten, hat die Antwort
zunächst korrekt gesagt "die Quellenausschnitte enthalten keine
Informationen darüber" -- ist dann aber trotzdem in eine allgemeine,
nicht durch Quellen gedeckte Erklärung übergegangen ("Allerdings kann
ich sagen, dass ..."), statt es bei der Ablehnung zu belassen. Verstößt
gegen Regel 1 ("nur mit Informationen aus den Ausschnitten antworten")
des System-Prompts.

Nach dem Anhaken der richtigen Quelle und erneutem Stellen derselben
Frage kam die korrekte, zitatgestützte Antwort. Das Verhalten trat also
nur auf, wenn tatsächlich keine relevanten Chunks vorlagen -- passt
grundsätzlich zur bereits bekannten Einschränkung, dass Llama sich bei
strikten Ausgabe-/Verhaltensvorgaben weniger zuverlässig verhält als
z. B. Claude (siehe CLAUDE.md, Abschnitt "Zitat-Zuverlässigkeit").

Mögliche Verbesserung: System-Prompt-Regel 2 durch ein explizites
Negativ-Beispiel verstärken (Frage ohne passende Ausschnitte + korrekte
Ablehnungsantwort als Vorbild), aehnlich wie beim Zitat-Format-Beispiel
weiter oben. Bringt vermutlich nicht 100% Zuverlässigkeit, sollte die
Haeufigkeit aber senken.
