import { extractText, getDocumentProxy } from "unpdf";

export const MIN_SOURCE_TEXT_LENGTH = 50;

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

export function validateSourceText(text: string): string | null {
  if (text.trim().length < MIN_SOURCE_TEXT_LENGTH) {
    return "Kein Text erkannt oder Text zu kurz — evtl. ein gescanntes PDF ohne OCR-Layer.";
  }
  return null;
}
