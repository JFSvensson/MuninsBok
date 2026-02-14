/**
 * SIE file encoding utilities.
 *
 * SIE files traditionally use CP437 (IBM PC codepage 437), declared as
 * `#FORMAT PC8` in the file header. Modern files may use UTF-8 instead.
 * This module detects the encoding from the raw bytes and decodes accordingly.
 */

/**
 * CP437 to Unicode mapping for bytes 0x80–0xFF.
 * Bytes 0x00–0x7F are identical to ASCII.
 */
// prettier-ignore
const CP437_HIGH: string[] = [
  // 0x80–0x8F
  "\u00C7", "\u00FC", "\u00E9", "\u00E2", "\u00E4", "\u00E0", "\u00E5", "\u00E7",
  "\u00EA", "\u00EB", "\u00E8", "\u00EF", "\u00EE", "\u00EC", "\u00C4", "\u00C5",
  // 0x90–0x9F
  "\u00C9", "\u00E6", "\u00C6", "\u00F4", "\u00F6", "\u00F2", "\u00FB", "\u00F9",
  "\u00FF", "\u00D6", "\u00DC", "\u00A2", "\u00A3", "\u00A5", "\u20A7", "\u0192",
  // 0xA0–0xAF
  "\u00E1", "\u00ED", "\u00F3", "\u00FA", "\u00F1", "\u00D1", "\u00AA", "\u00BA",
  "\u00BF", "\u2310", "\u00AC", "\u00BD", "\u00BC", "\u00A1", "\u00AB", "\u00BB",
  // 0xB0–0xBF
  "\u2591", "\u2592", "\u2593", "\u2502", "\u2524", "\u2561", "\u2562", "\u2556",
  "\u2555", "\u2563", "\u2551", "\u2557", "\u255D", "\u255C", "\u255B", "\u2510",
  // 0xC0–0xCF
  "\u2514", "\u2534", "\u252C", "\u251C", "\u2500", "\u253C", "\u255E", "\u255F",
  "\u255A", "\u2554", "\u2569", "\u2566", "\u2560", "\u2550", "\u256C", "\u2567",
  // 0xD0–0xDF
  "\u2568", "\u2564", "\u2565", "\u2559", "\u2558", "\u2552", "\u2553", "\u256B",
  "\u256A", "\u2518", "\u250C", "\u2588", "\u2584", "\u258C", "\u2590", "\u2580",
  // 0xE0–0xEF
  "\u03B1", "\u00DF", "\u0393", "\u03C0", "\u03A3", "\u03C3", "\u00B5", "\u03C4",
  "\u03A6", "\u0398", "\u03A9", "\u03B4", "\u221E", "\u03C6", "\u03B5", "\u2229",
  // 0xF0–0xFF
  "\u2261", "\u00B1", "\u2265", "\u2264", "\u2320", "\u2321", "\u00F7", "\u2248",
  "\u00B0", "\u2219", "\u00B7", "\u221A", "\u207F", "\u00B2", "\u25A0", "\u00A0",
];

/** Decode a byte array from CP437 to a Unicode string. */
function decodeCp437(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!;
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
    } else {
      result += CP437_HIGH[byte - 0x80]!;
    }
  }
  return result;
}

/**
 * Find an ASCII-safe tag value in raw bytes.
 * Works regardless of encoding since the tag name is pure ASCII.
 */
function findAsciiTagValue(bytes: Uint8Array, tag: string): string | null {
  const tagBytes = new TextEncoder().encode(tag);

  for (let i = 0; i <= bytes.length - tagBytes.length; i++) {
    let match = true;
    for (let j = 0; j < tagBytes.length; j++) {
      if (bytes[i + j] !== tagBytes[j]) {
        match = false;
        break;
      }
    }

    if (match) {
      // Skip spaces after tag
      let pos = i + tagBytes.length;
      while (pos < bytes.length && bytes[pos] === 0x20) pos++;

      // Read value until end of line
      let value = "";
      while (pos < bytes.length && bytes[pos] !== 0x0a && bytes[pos] !== 0x0d) {
        value += String.fromCharCode(bytes[pos]!);
        pos++;
      }

      return value.trim();
    }
  }

  return null;
}

/**
 * Decode a SIE file from raw bytes to a Unicode string.
 *
 * Strategy:
 * 1. Try UTF-8 first (modern files) — if it decodes cleanly, use it.
 * 2. Otherwise, scan the raw bytes for the `#FORMAT` tag.
 *    - `PC8` (or absent) → CP437
 *    - anything else → ISO-8859-1 as fallback
 */
export function decodeSieFile(bytes: Uint8Array): string {
  // Try UTF-8 (strict mode — throws on invalid sequences)
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const text = decoder.decode(bytes);
    // Verify it looks like a SIE file
    if (text.includes("#")) {
      return text;
    }
  } catch {
    // Not valid UTF-8 — fall through to legacy encodings
  }

  // Scan for #FORMAT tag (ASCII-safe, works on raw bytes)
  const format = findAsciiTagValue(bytes, "#FORMAT");

  if (format && format.toUpperCase() !== "PC8") {
    // Non-PC8 format: decode as ISO-8859-1
    const decoder = new TextDecoder("iso-8859-1");
    return decoder.decode(bytes);
  }

  // Default: CP437 (PC8 or no format tag)
  return decodeCp437(bytes);
}
