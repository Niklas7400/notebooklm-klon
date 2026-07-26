# Notizen für spätere Änderungen

Ideen/Beobachtungen, die während der Entwicklung aufgefallen sind, aber
bewusst nicht sofort umgesetzt wurden (Zeitrahmen, kein akuter Bug).

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
