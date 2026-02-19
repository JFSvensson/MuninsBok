import { describe, it, expect } from "vitest";
import { decodeSieFile } from "./encoding.js";

/** Helper: encode a string as UTF-8 bytes */
function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Helper: build a byte array with CP437-encoded Swedish characters */
function cp437Bytes(parts: (string | number[])[]): Uint8Array {
  const chunks: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      for (let i = 0; i < part.length; i++) {
        chunks.push(part.charCodeAt(i));
      }
    } else {
      chunks.push(...part);
    }
  }
  return new Uint8Array(chunks);
}

describe("decodeSieFile", () => {
  it("decodes a valid UTF-8 SIE file unchanged", () => {
    const input = utf8(
      '#FLAGGA 0\n#FORMAT PC8\n#FNAMN "Företag AB"\n#KONTO 2610 "Preliminärskatt"\n',
    );
    const result = decodeSieFile(input);
    expect(result).toContain("Företag AB");
    expect(result).toContain("Preliminärskatt");
  });

  it("decodes CP437-encoded åäö correctly", () => {
    // In CP437: å=0x86, ä=0x84, ö=0x94, Å=0x8F, Ä=0x8E, Ö=0x99
    // "Företag" in CP437: F ö r e t a g → F 0x94 r e t a g
    // "Preliminärskatt" → Prelimin 0x84 rskatt
    const input = cp437Bytes([
      "#FLAGGA 0\n#FORMAT PC8\n",
      '#FNAMN "F',
      [0x94], // ö
      'retag AB"\n',
      '#KONTO 2610 "Prelimin',
      [0x84], // ä
      'rskatt"\n',
    ]);
    const result = decodeSieFile(input);
    expect(result).toContain("Företag AB");
    expect(result).toContain("Preliminärskatt");
  });

  it("decodes all Swedish CP437 characters (å ä ö Å Ä Ö)", () => {
    const input = cp437Bytes([
      "#FLAGGA 0\n#FORMAT PC8\n",
      '#FNAMN "',
      [0x86, 0x84, 0x94, 0x8f, 0x8e, 0x99], // å ä ö Å Ä Ö
      '"\n',
    ]);
    const result = decodeSieFile(input);
    expect(result).toContain("åäöÅÄÖ");
  });

  it("handles CP437 file without explicit #FORMAT tag (defaults to PC8)", () => {
    const input = cp437Bytes([
      "#FLAGGA 0\n",
      '#FNAMN "',
      [0x86, 0x84, 0x94], // åäö
      '"\n',
    ]);
    const result = decodeSieFile(input);
    expect(result).toContain("åäö");
  });

  it("handles é in CP437 (common in Swedish accounting)", () => {
    // é = 0x82 in CP437
    const input = cp437Bytes([
      "#FLAGGA 0\n#FORMAT PC8\n",
      '#KONTO 1930 "Caf',
      [0x82], // é
      '"\n',
    ]);
    const result = decodeSieFile(input);
    expect(result).toContain("Café");
  });

  it("decodes ISO-8859-1 when format is not PC8", () => {
    // ISO-8859-1: å=0xE5, ä=0xE4, ö=0xF6
    const input = cp437Bytes([
      "#FLAGGA 0\n#FORMAT ISO8859-1\n",
      '#FNAMN "F',
      [0xf6], // ö in Latin-1
      'retag AB"\n',
      '#KONTO 2610 "Prelimin',
      [0xe4], // ä in Latin-1
      'rskatt"\n',
    ]);
    const result = decodeSieFile(input);
    expect(result).toContain("Företag AB");
    expect(result).toContain("Preliminärskatt");
  });

  it("preserves ASCII content faithfully", () => {
    const input = utf8('#FLAGGA 0\n#SIETYP 4\n#PROGRAM "Test" "1.0"\n#KONTO 1930 "Bank"\n');
    const result = decodeSieFile(input);
    expect(result).toContain("#FLAGGA 0");
    expect(result).toContain('#PROGRAM "Test" "1.0"');
    expect(result).toContain("Bank");
  });

  it("handles a realistic CP437-encoded SIE file", () => {
    const input = cp437Bytes([
      "#FLAGGA 0\r\n",
      "#FORMAT PC8\r\n",
      "#SIETYP 4\r\n",
      '#PROGRAM "Bokf',
      [0x94], // ö
      'ringsprogram" "1.0"\r\n',
      '#FNAMN "Sm',
      [0x86], // å
      "f",
      [0x94], // ö
      'retaget AB"\r\n',
      '#KONTO 2610 "Prelimin',
      [0x84], // ä
      'rskatt"\r\n',
      '#KONTO 3010 "F',
      [0x94], // ö
      "rs",
      [0x84], // ä
      "ljning varor 25%",
      '"\r\n',
      '#KONTO 6570 "Bankkostnader och l',
      [0x86], // å
      'nekostnader"\r\n',
    ]);
    const result = decodeSieFile(input);
    expect(result).toContain("Bokföringsprogram");
    expect(result).toContain("Småföretaget AB");
    expect(result).toContain("Preliminärskatt");
    expect(result).toContain("Försäljning varor 25%");
    expect(result).toContain("Bankkostnader och lånekostnader");
  });
});
