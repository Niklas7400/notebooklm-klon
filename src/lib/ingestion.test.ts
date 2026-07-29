import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, htmlToText, stripControlChars, validateSourceText } from "./ingestion";

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

describe("decodeHtmlEntities", () => {
  it("dekodiert die gaengigen benannten Entities", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry &lt;3&gt; &quot;Test&quot; &#39;x&#39;")).toBe(
      `Tom & Jerry <3> "Test" 'x'`
    );
  });

  it("dekodiert numerische Entities", () => {
    expect(decodeHtmlEntities("&#65;&#66;&#67;")).toBe("ABC");
  });

  it("wandelt &nbsp; in ein normales Leerzeichen um", () => {
    expect(decodeHtmlEntities("a&nbsp;b")).toBe("a b");
  });
});

describe("htmlToText", () => {
  it("entfernt script- und style-Bloecke komplett, inkl. ihres Inhalts", () => {
    const html =
      "<html><head><style>body{color:red}</style></head><body><script>alert(1)</script>Hallo</body></html>";
    expect(htmlToText(html)).toBe("Hallo");
  });

  it("entfernt HTML-Kommentare", () => {
    expect(htmlToText("<!-- Kommentar --> Text")).toBe("Text");
  });

  it("dekodiert HTML-Entities im extrahierten Text", () => {
    expect(htmlToText("<p>Tom &amp; Jerry</p>")).toBe("Tom & Jerry");
  });

  it("kollabiert mehrfachen Leerraum zu einem einzigen Leerzeichen", () => {
    expect(htmlToText("<p>Zu     viele     Leerzeichen</p>")).toBe("Zu viele Leerzeichen");
  });
});

describe("stripControlChars", () => {
  it("entfernt ein eingebettetes NUL-Byte (z.B. aus einer defekten PDF-Ligatur)", () => {
    const nul = String.fromCharCode(0);
    expect(stripControlChars(`A${nul}ect`)).toBe("Aect");
  });

  it("entfernt weitere C0-Steuerzeichen ausserhalb von Tab/LF/CR", () => {
    const stx = String.fromCharCode(2);
    const canc = String.fromCharCode(24);
    const del = String.fromCharCode(127);
    expect(stripControlChars(`vor${stx}mitte${canc}nach${del}ende`)).toBe("vormittenachende");
  });

  it("laesst Tab, Zeilenumbruch und Wagenruecklauf unangetastet", () => {
    const text = "Zeile1\nZeile2\tSpalte\rEnde";
    expect(stripControlChars(text)).toBe(text);
  });

  it("laesst normalen Text unveraendert", () => {
    expect(stripControlChars("Ganz normaler Text ohne Steuerzeichen.")).toBe(
      "Ganz normaler Text ohne Steuerzeichen."
    );
  });
});
