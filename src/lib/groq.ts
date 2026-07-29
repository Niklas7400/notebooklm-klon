import type { AudioScriptLine } from "@/lib/types";
import { FALLBACK_MODEL_MARKER } from "@/lib/modelFallback";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const CHAT_MODEL = "llama-3.3-70b-versatile";
// Faellt automatisch auf dieses Modell zurueck, wenn CHAT_MODEL sein
// Tageslimit (TPD) erreicht hat -- separat limitiert, bereits an anderer
// Stelle (Query-Rewriting) erprobt. Eine schwaechere Antwort mit Hinweis ist
// besser als ein rohes Rate-Limit-Fehler, das der Nutzer nicht einordnen kann.
const CHAT_MODEL_FALLBACK = "llama-3.1-8b-instant";
const REWRITE_MODEL = "llama-3.1-8b-instant";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function isRateLimitStatus(status: number): boolean {
  return status === 429;
}

// Groq liefert Fehler als {"error":{"message":"...","type":"...","code":"..."}}
// -- die reine .message ist fuer den Nutzer deutlich lesbarer als der ganze
// rohe JSON-Body (inkl. system_fingerprint etc.), der vorher 1:1 durchgereicht
// wurde.
function extractGroqErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (typeof parsed.error?.message === "string") return parsed.error.message;
  } catch {
    // body war kein JSON -- Rohtext unveraendert weiterreichen.
  }
  return body;
}

export type GroqCallResult = { text: string; usedFallbackModel: boolean };

async function groqChat(
  model: string,
  messages: ChatMessage[],
  fallbackModel?: string
): Promise<GroqCallResult> {
  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (isRateLimitStatus(res.status) && fallbackModel) {
      const fallback = await groqChat(fallbackModel, messages);
      return { text: fallback.text, usedFallbackModel: true };
    }
    throw new Error(`Groq (${model}, Status ${res.status}): ${extractGroqErrorMessage(body)}`);
  }

  const json = await res.json();
  return { text: json.choices[0].message.content as string, usedFallbackModel: false };
}

// Formt Frage + Verlauf zu einer eigenstaendigen Suchanfrage um (Folgefragen
// wie "Und was sagt der Autor dazu?" sind fuer die Aehnlichkeitssuche sonst
// wertlos). Nur aufrufen, wenn bereits Verlauf existiert.
export async function rewriteQuery(
  question: string,
  history: ChatMessage[]
): Promise<string> {
  const historyText = history
    .map((m) => `${m.role === "user" ? "Nutzer" : "Assistent"}: ${m.content}`)
    .join("\n");

  const prompt = `Formuliere die folgende Frage anhand des Gespraechsverlaufs als eigenstaendige Suchanfrage um. Antworte NUR mit der umformulierten Frage, ohne Anfuehrungszeichen oder Erklaerung.

Verlauf:
${historyText}

Frage: ${question}`;

  const { text } = await groqChat(REWRITE_MODEL, [{ role: "user", content: prompt }]);
  return text.trim();
}

// Streaming-Variante fuer den Chat (Tag 6): liefert die Antwort als Folge von
// Text-Deltas statt einmalig am Stueck, damit das Frontend Tokens anzeigen
// kann, sobald sie ankommen. Groq streamt im gleichen SSE-Format wie OpenAI
// ("data: {...}\n\n", abgeschlossen mit "data: [DONE]").
export async function* streamAnswerQuestion(
  systemPrompt: string,
  history: ChatMessage[],
  question: string
): AsyncGenerator<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: question },
  ];

  function requestStream(model: string) {
    return fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });
  }

  let res = await requestStream(CHAT_MODEL);
  let usedFallbackModel = false;

  if (!res.ok) {
    const primaryBody = await res.text().catch(() => "");
    if (isRateLimitStatus(res.status)) {
      // Gleiche Fallback-Logik wie in groqChat, hier von Hand nachgebaut, weil
      // der Streaming-Response-Body nicht durch groqChat laeuft.
      usedFallbackModel = true;
      res = await requestStream(CHAT_MODEL_FALLBACK);
    }
    if (!res.ok) {
      const body = usedFallbackModel ? await res.text().catch(() => "") : primaryBody;
      throw new Error(`Groq (Status ${res.status}): ${extractGroqErrorMessage(body)}`);
    }
  }

  if (!res.body) {
    throw new Error("Groq-Streaming-Antwort enthielt keinen Body.");
  }

  // Sentinel als allererster Chunk, noch vor dem eigentlichen Antworttext --
  // der Client kann so sofort erkennen, dass eine Antwort vom Ausweichmodell
  // folgt (siehe lib/modelFallback.ts fuer das Herausfiltern beim Anzeigen).
  if (usedFallbackModel) {
    yield FALLBACK_MODEL_MARKER;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;

      const json = JSON.parse(data);
      const delta: string | undefined = json.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

// Notebook Guide: kurze Zusammenfassung ueber alle Quellen, bei jedem Upload
// neu erzeugt (nicht nur beim ersten), damit sie nach dem zweiten Upload
// nicht veraltet wirkt.
export function summarizeSources(context: string): Promise<GroqCallResult> {
  const prompt = `Erstelle eine kurze, gut lesbare Zusammenfassung ("Notebook Guide") der folgenden Quellen fuer jemanden, der sich schnell einen Ueberblick verschaffen will. 3-6 Saetze oder kurze Bullet Points, die die Kernaussagen aller Quellen zusammen abdecken. Antworte in der Sprache der Quellen.

Quellen:
${context}`;

  return groqChat(CHAT_MODEL, [{ role: "user", content: prompt }], CHAT_MODEL_FALLBACK);
}

// Vorgeschlagene Einstiegsfragen (optionales Feature): nach jedem Upload neu
// generiert, damit sie zu den aktuell vorhandenen Quellen passen. Leichtes
// Modell (wie beim Query-Rewriting) reicht fuer diese kurze Aufgabe.
export async function generateSuggestedQuestions(context: string): Promise<string[]> {
  const prompt = `Schlage genau 4 kurze Einstiegsfragen vor, die ein Nutzer zu den folgenden Quellen stellen koennte. Eine Frage pro Zeile, ohne Nummerierung, ohne Aufzaehlungszeichen, ohne Einleitung oder Erklaerung. Antworte in der Sprache der Quellen.

Quellen:
${context}`;

  const { text } = await groqChat(REWRITE_MODEL, [{ role: "user", content: prompt }]);
  return text
    .split("\n")
    .map((line) => line.replace(/^[\s\-*\d.)]+/, "").trim())
    // Llama haelt sich trotz "ohne Einleitung" gelegentlich nicht daran und
    // stellt eine Ankuendigungszeile voran ("Hier sind vier Fragen: ...").
    // Ein "?" am Ende ist ein zuverlaessiger Filter dafuer, dass die Zeile
    // tatsaechlich eine Frage ist statt einer Einleitung/Erklaerung.
    .filter((line) => line.endsWith("?"))
    .slice(0, 4);
}

// Folgefragen nach jeder Chat-Antwort (Nutzerwunsch, nicht in CLAUDE.md
// vorgegeben): gleiches leichtes Modell wie beim Query-Rewriting, damit der
// Zusatz-Call die eigentliche (gestreamte) Antwort nicht spuerbar verzoegert.
// Bekommt zusaetzlich zum Frage-Antwort-Austausch die tatsaechlich gefundenen
// Quellenausschnitte -- sonst assoziiert das Modell frei anhand des reinen
// Antworttexts und schlaegt Folgefragen zu Themen vor, die die Quelle gar
// nicht abdeckt (beobachtet: Nutzer klickt eine plausibel klingende, aber
// unbeantwortbare Folgefrage an, Antwort ist eine Ablehnung).
export async function generateFollowUpQuestions(
  question: string,
  answer: string,
  sourceContext: string
): Promise<string[]> {
  const prompt = `Basierend auf diesem Frage-Antwort-Austausch und den folgenden Quellenausschnitten: schlage genau 2-3 kurze, natuerliche Folgefragen vor, die der Nutzer als naechstes stellen koennte. Wichtig: Nur Fragen vorschlagen, die sich anhand der Quellenausschnitte tatsaechlich beantworten lassen -- keine Fragen zu Themen, die darin nicht vorkommen. Eine Frage pro Zeile, ohne Nummerierung, ohne Aufzaehlungszeichen, ohne Einleitung oder Erklaerung. Antworte in der Sprache des Austauschs.

Quellenausschnitte:
${sourceContext}

Frage: ${question}
Antwort: ${answer}`;

  const { text } = await groqChat(REWRITE_MODEL, [{ role: "user", content: prompt }]);
  return text
    .split("\n")
    .map((line) => line.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter((line) => line.endsWith("?"))
    .slice(0, 3);
}

// Study Guide (optionales Feature): Kernkonzepte + FAQ auf Knopfdruck, nicht
// persistiert (im Gegensatz zum Notebook Guide) -- bei Bedarf neu generiert.
// Genau zwei fest vorgegebene Abschnittsueberschriften statt eines "oder"
// zwischen Formaten, siehe NOTES.md zum Zusammenfassungs-Prompt-Problem.
export function generateStudyGuide(context: string): Promise<GroqCallResult> {
  const prompt = `Erstelle einen Study Guide zu den folgenden Quellen mit GENAU diesen zwei Abschnitten (als Markdown-Ueberschriften):

## Kernkonzepte
Bullet Points mit den wichtigsten Begriffen/Konzepten aus den Quellen, je Punkt eine kurze Erklaerung.

## Häufige Fragen
4-6 Frage-Antwort-Paare, die typische Verstaendnisfragen zu den Quellen beantworten. Format: "**F:** ...\\n**A:** ...".

Antworte in der Sprache der Quellen. Nur diese zwei Abschnitte, keine Einleitung und keinen Abschlusssatz davor/danach.

Quellen:
${context}`;

  return groqChat(CHAT_MODEL, [{ role: "user", content: prompt }], CHAT_MODEL_FALLBACK);
}

// Entfernt einen ```-Codeblock-Wrapper, falls Llama die Markdown-Antwort
// trotz Anweisung doch einmal darin einpackt (gleiche Grundtoleranz wie beim
// Audio-Skript-Parsing weiter unten).
export function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

// Mind Map (optionales Feature, urspruenglich bewusst ausgelassen, siehe
// CLAUDE.md): verschachtelte Markdown-Gliederung statt strengem JSON, weil
// Llama dieses Format schon beim Study Guide zuverlaessig liefert. Das
// Frontend rendert die Gliederung per Markmap zu einer interaktiven Mind Map
// -- die Baum-Layout-Arbeit uebernimmt die Bibliothek, nicht der Prompt.
export async function generateMindMap(context: string): Promise<GroqCallResult> {
  const prompt = `Erstelle eine Mind Map als verschachtelte Markdown-Gliederung zu den folgenden Quellen.

Format (Beispiel, nur zur Veranschaulichung des Formats):
# Zentrales Thema
## Erster Hauptast
- Unterpunkt
- Unterpunkt
  - Detailpunkt
## Zweiter Hauptast
- Unterpunkt

Regeln:
- Genau eine Wurzel-Überschrift (#) mit einem kurzen, prägnanten Titel für das gesamte Notebook.
- 3–6 Hauptäste als Überschriften zweiter Ebene (##).
- Pro Hauptast 2–4 Unterpunkte als Bullet-Liste, kurze Stichpunkte statt ganzer Sätze.
- Nur die Gliederung selbst, keine Einleitung, keine Erklärung, keine Code-Blocks.
- Antworte in der Sprache der Quellen.

Quellen:
${context}`;

  const { text, usedFallbackModel } = await groqChat(
    CHAT_MODEL,
    [{ role: "user", content: prompt }],
    CHAT_MODEL_FALLBACK
  );
  return { text: stripMarkdownCodeFence(text), usedFallbackModel };
}

// Audio Overview (Tag 8): lockeres Zwei-Personen-Podcast-Skript als JSON.
// Auf Anfrage generiert, nicht bei jedem Upload (siehe CLAUDE.md) -- TTS hat
// im Gegensatz zu Groq ein begrenztes Freikontingent.
export async function generateAudioScript(
  context: string
): Promise<{ script: AudioScriptLine[]; usedFallbackModel: boolean }> {
  const prompt = `Erstelle ein lockeres Zwei-Personen-Podcast-Gespräch (Host A und Host B) auf Basis der folgenden Notebook-Inhalte. Ca. 3-5 Minuten Sprechzeit (etwa 12-18 kurze Gesprächs-Zeilen), locker und natürlich im Ton, für Laien verständlich, greift die Kernaussagen der Quellen auf. Antworte in der Sprache der Quellen.

Antworte AUSSCHLIESSLICH mit einem JSON-Array in genau diesem Format, ohne Markdown-Codeblock und ohne Text davor oder danach:
[{"speaker":"A","text":"..."},{"speaker":"B","text":"..."}]

Notebook-Inhalte:
${context}`;

  const { text, usedFallbackModel } = await groqChat(
    CHAT_MODEL,
    [{ role: "user", content: prompt }],
    CHAT_MODEL_FALLBACK
  );
  return { script: parseAudioScript(text), usedFallbackModel };
}

function tryParseJsonArrayFromBrackets(raw: string): unknown[] | null {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const value = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// Findet zu einer oeffnenden "{" an position `start` die zugehoerige
// schliessende "}" unter Beruecksichtigung von String-Literalen (Klammern
// innerhalb von Anführungszeichen zaehlen nicht mit, Escape-Sequenzen wie
// \" werden uebersprungen). Gibt -1 zurueck, wenn keine passende Klammer
// gefunden wird (abgeschnittene Antwort).
function findMatchingBrace(raw: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isScriptLine(value: unknown): value is AudioScriptLine {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.speaker === "A" || candidate.speaker === "B") &&
    typeof candidate.text === "string" &&
    candidate.text.trim().length > 0
  );
}

// Erstes klammer-balanciertes "{...}"-Objekt im Rohtext, sofern es sich als
// JSON-Objekt parsen laesst (z.B. ein Wrapper wie {"titel": "...",
// "script": [...]}, mit dem manche Modelle das geforderte nackte Array
// umhuellen).
function tryParseJsonObjectFromBraces(raw: string): unknown | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  const end = findMatchingBrace(raw, start);
  if (end === -1) return null;
  try {
    const value = JSON.parse(raw.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function collectScriptArrays(node: unknown, found: AudioScriptLine[][]): void {
  if (Array.isArray(node)) {
    if (node.length > 0 && node.every(isScriptLine)) {
      found.push(node);
      return;
    }
    for (const item of node) collectScriptArrays(item, found);
    return;
  }
  if (node && typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectScriptArrays(value, found);
    }
  }
}

// Sucht im geparsten Wrapper-Objekt (beliebig tief) nach dem eigentlichen
// Skript-Array: dem laengsten Array, dessen Elemente *alle* Gespraechs-Zeilen
// sind. Bewusst das laengste statt "alle zusammen": Das Modell echot
// gelegentlich auch das Formatbeispiel aus dem Prompt als zweites, kurzes
// Array mit -- die Zeilen beider Arrays einzusammeln ergaebe ein doppeltes,
// wirres Gespraech. Feldnamen werden absichtlich ignoriert (mal "script",
// mal "dialog", mal "podcast").
function findLongestScriptArray(root: unknown): AudioScriptLine[] | null {
  const found: AudioScriptLine[][] = [];
  collectScriptArrays(root, found);
  if (found.length === 0) return null;
  // Bei Gleichstand gewinnt das zuerst gefundene Array.
  return found.reduce((longest, current) => (current.length > longest.length ? current : longest));
}

type RawScanResult = { lines: AudioScriptLine[]; sawJson: boolean };

// Letzter Ausweg fuer Antworten, die als Ganzes gar kein valides JSON mehr
// sind (abgeschnittene Antwort, Trailing-Komma im Array, mehrere separate
// Arrays hintereinander -- alles live beim Fallback-Modell
// llama-3.1-8b-instant nach einem Groq-Tageslimit beobachtet): jedes
// klammer-balancierte "{...}" einzeln parsen und die Gespraechs-Zeilen
// einsammeln. `sawJson` haelt fest, ob ueberhaupt irgendein JSON-Objekt
// parsebar war -- nur so laesst sich "gar kein JSON gefunden" von "JSON
// gefunden, aber keine gueltige Zeile darin" unterscheiden.
function scanScriptObjects(raw: string): RawScanResult {
  const lines: AudioScriptLine[] = [];
  let sawJson = false;
  let i = raw.indexOf("{");
  while (i !== -1) {
    const end = findMatchingBrace(raw, i);
    if (end === -1) {
      // Keine passende "}" (z.B. Wrapper-Klammer um eine abgeschnittene
      // Antwort) -- nicht abbrechen, sondern ab der naechsten "{"
      // weitersuchen: darin koennen bereits abgeschlossene Zeilen stecken.
      i = raw.indexOf("{", i + 1);
      continue;
    }
    let value: unknown;
    try {
      value = JSON.parse(raw.slice(i, end + 1));
    } catch {
      // Kein valides JSON an dieser Stelle -- ab i + 1 (nicht end + 1)
      // weitersuchen, damit verschachtelte valide Objekte gefunden werden.
      i = raw.indexOf("{", i + 1);
      continue;
    }
    sawJson = true;
    if (isScriptLine(value)) {
      lines.push(value);
      i = raw.indexOf("{", end + 1);
    } else {
      i = raw.indexOf("{", i + 1);
    }
  }
  return { lines, sawJson };
}

// Rueckgabe: null = im Rohtext war ueberhaupt kein parsebares JSON;
// [] = JSON gefunden, aber keine einzige gueltige Gespraechs-Zeile darin.
// Die Unterscheidung bestimmt die Fehlermeldung, die im Audio-Overview-UI
// landet -- eine falsche Meldung fuehrt beim Debuggen in die Irre.
function extractScriptLines(raw: string): AudioScriptLine[] | null {
  const array = tryParseJsonArrayFromBrackets(raw);
  if (array) return array.filter(isScriptLine);

  const wrapper = tryParseJsonObjectFromBraces(raw);
  if (wrapper) {
    const scriptArray = findLongestScriptArray(wrapper);
    if (scriptArray) return scriptArray;
  }

  const scan = scanScriptObjects(raw);
  if (scan.lines.length > 0) return scan.lines;
  return scan.sawJson || wrapper !== null ? [] : null;
}

// Exportiert, damit die JSON-Parsing-/Validierungslogik isoliert testbar ist.
export function parseAudioScript(raw: string): AudioScriptLine[] {
  const lines = extractScriptLines(raw);
  if (lines === null) {
    throw new Error("Skript-Antwort enthielt kein JSON-Array.");
  }
  if (lines.length === 0) {
    throw new Error("Skript enthielt keine gültigen Gesprächs-Zeilen.");
  }
  return lines;
}
