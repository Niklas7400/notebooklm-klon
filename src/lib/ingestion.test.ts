import { describe, expect, it } from "vitest";
import { validateSourceText } from "./ingestion";

describe("validateSourceText", () => {
  it("lehnt leeren Text ab", () => {
    expect(validateSourceText("")).not.toBeNull();
  });

  it("lehnt sehr kurzen Text ab (z.B. Bild-PDF ohne OCR-Layer)", () => {
    expect(validateSourceText("Kein Text.")).not.toBeNull();
  });

  it("lehnt Text ab, der nur aus Leerraum besteht", () => {
    expect(validateSourceText("   \n\n\t  ")).not.toBeNull();
  });

  it("akzeptiert ausreichend langen Text", () => {
    const text = "Dies ist ein ausreichend langer Beispieltext fuer einen echten Upload. ".repeat(2);
    expect(validateSourceText(text)).toBeNull();
  });
});
