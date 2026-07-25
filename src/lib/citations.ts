// Tolerant gegenueber leichten Format-Abweichungen des Modells (z.B. ohne
// eckige Klammern), siehe Hinweis zur Zitat-Zuverlaessigkeit in CLAUDE.md.
export const CITATION_REGEX = /\[?chunk:\s*(\d+)\]?/gi;

export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "citation"; localId: number; raw: string };

// Reine Parsing-Logik (kein JSX) -- getrennt von der Darstellung in Chat.tsx,
// damit sich das Zitat-Format isoliert testen laesst.
export function splitContentByCitations(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(CITATION_REGEX);

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: "citation", localId: parseInt(match[1], 10), raw: match[0] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }
  return segments;
}
