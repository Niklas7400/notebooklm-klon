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

## TTS-Aussprache englischer Fachbegriffe im Audio Overview

Beobachtet beim Testen (Tag 8): Mit den urspruenglichen WaveNet-Stimmen
sprach Google Cloud TTS englische Fachbegriffe im sonst deutschen
Podcast-Skript (RAG, Embedding, Voice AI Agents, ...) mit deutscher
Phonetik aus, weil die gesamte Zeile mit `languageCode: "de-DE"`
synthetisiert wird -- keine Sprach-Erkennung pro Wort. Umgestellt auf
`de-DE-Chirp3-HD-Kore`/`-Charon` (Gemini-basiertes Voice-Modell,
handhabt Code-Switching robuster); deutlich besser laut Nutzer-Feedback,
aber nicht perfekt.

Zwei weitere Stufen bewusst nicht verfolgt (kein akutes Problem mehr,
kostet zusaetzliches Geld/Setup):
- SSML mit expliziten `<lang xml:lang="en-US">`-Tags um erkannte
  englische Begriffe -- braucht eine Erkennung, welche Woerter englisch
  sind (z.B. Groq beim Skript-Generieren mit einem Marker umschliessen
  lassen), neues Formatrisiko aehnlich den beiden Eintraegen oben.
- Geminis natives Multi-Speaker-TTS (`gemini-2.5-flash-preview-tts`) --
  live getestet, funktioniert technisch mit demselben Google-Cloud-
  API-Key (nur "Generative Language API" + API-Key-Restriction musste
  freigeschaltet werden), haengt aber an einem separaten AI-Studio-
  Prepay-Konto statt am allgemeinen Cloud-Guthaben. Ohne Aufladen dieses
  getrennten Kontos nicht nutzbar.

ElevenLabs als Alternative von Anfang an ausgeschlossen (siehe CLAUDE.md
Tech-Stack-Begruendung: 10.000 Zeichen/Monat Free Tier + Wasserzeichen).
