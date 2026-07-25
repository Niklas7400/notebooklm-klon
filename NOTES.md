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
