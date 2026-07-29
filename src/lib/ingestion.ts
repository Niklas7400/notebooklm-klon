import { extractText, getDocumentProxy } from "unpdf";

export const MIN_SOURCE_TEXT_LENGTH = 50;

// PDFs mit unvollstaendiger ToUnicode-Zuordnung fuer Ligaturen (z.B. "ffi",
// "ff") liefern an dieser Stelle vereinzelt rohe Steuerzeichen statt der
// eigentlichen Buchstaben -- beobachtet als NUL-Byte anstelle von "ff" in
// "Affect". Ein eingebettetes NUL-Byte bringt spaeter den Insert nach
// Supabase zu Fall (Postgres/PostgREST lehnt Text mit NUL-Byte beim JSON-
// Parsing mit "unsupported Unicode escape sequence" ab), weit entfernt vom
// eigentlichen Ursprung in der PDF-Extraktion. Deshalb hier direkt bereinigen,
// statt das erst beim DB-Insert scheitern zu lassen. Zeichencode-Vergleich
// statt Regex-Zeichenklasse mit Steuerzeichen-Escapes im Quelltext.
function isStrippableControlCharCode(code: number): boolean {
  const isTab = code === 9;
  const isLineFeed = code === 10;
  const isCarriageReturn = code === 13;
  const isC0Control = code <= 31;
  const isDelete = code === 127;
  return (isC0Control && !isTab && !isLineFeed && !isCarriageReturn) || isDelete;
}

export function stripControlChars(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    if (!isStrippableControlCharCode(text.charCodeAt(i))) {
      result += text[i];
    }
  }
  return result;
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return stripControlChars(text.trim());
}

export function validateSourceText(text: string): string | null {
  if (text.trim().length < MIN_SOURCE_TEXT_LENGTH) {
    return "Kein Text erkannt oder Text zu kurz — evtl. ein gescanntes PDF ohne OCR-Layer.";
  }
  return null;
}

// Sicherheitsgrenze gegen sehr grosse Seiten (z.B. versehentlich verlinkte
// Downloads) -- ohne diese Grenze wuerde der komplette HTML-Body erst
// eingelesen, bevor ueberhaupt geprueft wird, ob die Seite sinnvoll ist.
const MAX_URL_HTML_BYTES = 5_000_000;

export async function fetchUrlText(
  url: string
): Promise<{ text: string; title: string | null }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Ungültige URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Nur http/https-URLs werden unterstützt.");
  }

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "NotebookLM-Klon/1.0 (+Demo-Projekt)" },
      redirect: "follow",
    });
  } catch {
    throw new Error("Seite nicht erreichbar — URL prüfen.");
  }
  if (!res.ok) {
    throw new Error(`Seite konnte nicht geladen werden (Status ${res.status}).`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    throw new Error(`URL liefert kein HTML (Content-Type: ${contentType || "unbekannt"}).`);
  }

  const html = await res.text();
  if (html.length > MAX_URL_HTML_BYTES) {
    throw new Error("Seite ist zu groß, um verarbeitet zu werden.");
  }

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : null;

  return { text: htmlToText(html), title };
}

// Bewusst eine einfache Regex-basierte Extraktion statt einer zusaetzlichen
// Abhaengigkeit wie jsdom/Readability -- fuer ein Demo-Projekt reicht reiner
// Fliesstext, ein sauber aufbereiteter Lesemodus ist nicht das Ziel.
// Exportiert, damit die Extraktionslogik isoliert testbar ist.
export function htmlToText(html: string): string {
  const withoutJunk = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const withBreaks = withoutJunk.replace(
    /<\/(p|div|li|h[1-6]|br|section|article|tr)>/gi,
    "\n"
  );
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(stripped);
  return decoded
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)));
}
