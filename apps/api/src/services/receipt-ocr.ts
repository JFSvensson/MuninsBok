import type { ReceiptOcrAnalysis, ReceiptOcrPrefillLine } from "@muninsbok/core/api-types";
import { createWorker } from "tesseract.js";
import { AppError } from "../utils/app-error.js";

const OCR_SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TOTAL_LINE_PATTERN = /\b(summa|total|totalt|att betala|belopp att betala|sum to pay)\b/i;
const VAT_LINE_PATTERN = /\b(moms|vat|tax)\b/i;
const DATE_LINE_PATTERN = /\b(datum|date)\b/i;
const CURRENCY_PATTERN = /\b(sek|kr|eur|usd)\b/i;
const MERCHANT_BLOCKLIST =
  /\b(kvitto|receipt|summa|moms|vat|org\.?nr|telefon|tel|bankgiro|plusgiro|momsspec|att betala|datum|tid|kassa|kort|visa|mastercard)\b/i;

export interface ReceiptOcrInput {
  buffer: Uint8Array;
  filename: string;
  mimeType: string;
}

export interface IReceiptOcrService {
  analyze(input: ReceiptOcrInput): Promise<ReceiptOcrAnalysis>;
}

interface ReceiptAmountCandidate {
  ore: number;
  raw: string;
  line: string;
  index: number;
  score: number;
}

interface ParsedDateCandidate {
  isoDate: string;
  score: number;
}

interface ParseReceiptTextInput {
  sourceFilename: string;
  mimeType: string;
  extractedText: string;
  confidence: number;
}

function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function parseAmountToOre(raw: string): number | null {
  const cleaned = raw.replace(/\s+/g, "").replace(/[A-Za-z]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);

  if (decimalIndex === -1) {
    if (!/^\d+$/.test(cleaned)) return null;
    return Number.parseInt(cleaned, 10) * 100;
  }

  const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
  const decimalPart = cleaned.slice(decimalIndex + 1).replace(/[.,]/g, "");
  if (!/^\d+$/.test(integerPart) || !/^\d{1,2}$/.test(decimalPart)) return null;

  const normalized = `${integerPart}.${decimalPart.padEnd(2, "0")}`;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > new Date().getFullYear() + 1) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!isValidDate(year, month, day)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractDate(lines: string[]): string | undefined {
  const candidates: ParsedDateCandidate[] = [];

  for (const [index, line] of lines.entries()) {
    const scoreBase = (DATE_LINE_PATTERN.test(line) ? 100 : 0) + Math.max(0, 20 - index);

    for (const match of line.matchAll(
      /\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g,
    )) {
      const isoDate = toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
      if (isoDate) candidates.push({ isoDate, score: scoreBase + 20 });
    }

    for (const match of line.matchAll(
      /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.]((?:20)?\d{2})\b/g,
    )) {
      const rawYear = match[3];
      if (!rawYear) continue;
      const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
      const isoDate = toIsoDate(year, Number(match[2]), Number(match[1]));
      if (isoDate) candidates.push({ isoDate, score: scoreBase + 10 });
    }
  }

  return candidates.sort((left, right) => right.score - left.score)[0]?.isoDate;
}

function extractMerchant(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 8)) {
    const normalized = normalizeLine(line.replace(/[|*_~`]/g, ""));
    if (normalized.length < 3 || normalized.length > 60) continue;
    if (!/[A-Za-zÅÄÖåäö]{3}/.test(normalized)) continue;
    if (MERCHANT_BLOCKLIST.test(normalized)) continue;
    if (/\d{4,}/.test(normalized)) continue;
    if (normalized.includes("@") || normalized.includes("www.")) continue;
    return normalized;
  }

  return undefined;
}

function extractAmountCandidates(lines: string[], matcher: RegExp): ReceiptAmountCandidate[] {
  const candidates: ReceiptAmountCandidate[] = [];

  for (const [index, line] of lines.entries()) {
    const amounts = Array.from(
      line.matchAll(/(?:\d{1,3}(?:[ .]\d{3})+|\d+)(?:[,.]\d{2})/g),
      (match) => match[0],
    );

    for (const amount of amounts) {
      const ore = parseAmountToOre(amount);
      if (ore == null || ore <= 0) continue;

      let score = Math.max(0, 15 - index);
      if (matcher.test(line)) score += 100;
      if (DATE_LINE_PATTERN.test(line)) score -= 40;

      candidates.push({ ore, raw: amount, line, index, score });
    }
  }

  return candidates;
}

function detectCurrency(text: string): string | undefined {
  const match = text.match(CURRENCY_PATTERN)?.[0]?.toLowerCase();
  if (!match) return undefined;
  if (match === "eur") return "EUR";
  if (match === "usd") return "USD";
  return "SEK";
}

function buildPrefillLines(
  totalAmountOre: number | undefined,
  description: string,
): ReceiptOcrPrefillLine[] {
  if (totalAmountOre == null) return [];

  return [
    {
      debit: totalAmountOre,
      credit: 0,
      description,
    },
    {
      debit: 0,
      credit: totalAmountOre,
      description: "Betalning",
    },
  ];
}

export function supportsReceiptOcrMimeType(mimeType: string): boolean {
  return OCR_SUPPORTED_MIME_TYPES.has(mimeType);
}

export function parseReceiptText(input: ParseReceiptTextInput): ReceiptOcrAnalysis {
  const extractedText = input.extractedText.replace(/\r/g, "").trim();
  if (!extractedText) {
    throw AppError.badRequest("Ingen text kunde lasas ut ur bilden", "OCR_NO_TEXT");
  }

  const lines = extractedText.split("\n").map(normalizeLine).filter(Boolean);

  const merchantName = extractMerchant(lines);
  const transactionDate = extractDate(lines);
  const totalCandidates = extractAmountCandidates(lines, TOTAL_LINE_PATTERN).filter(
    (candidate) => !VAT_LINE_PATTERN.test(candidate.line),
  );
  const fallbackAmountCandidates = extractAmountCandidates(lines, /^$/);
  const vatCandidates = extractAmountCandidates(lines, VAT_LINE_PATTERN);

  const bestTotal =
    [...totalCandidates].sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.ore - left.ore;
    })[0] ?? [...fallbackAmountCandidates].sort((left, right) => right.ore - left.ore)[0];

  const totalAmountOre = bestTotal?.ore;
  const vatAmountOre = [...vatCandidates].sort((left, right) => right.score - left.score)[0]?.ore;
  const baseDescription = merchantName ?? stripFileExtension(input.sourceFilename);
  const suggestedDescription = merchantName
    ? `Kvitto ${merchantName}`
    : `Kvitto ${baseDescription}`;
  const currency = detectCurrency(extractedText);
  const warnings: string[] = [];

  if (input.confidence < 55) {
    warnings.push("OCR-sakerheten ar lag. Kontrollera datum och belopp manuellt.");
  }
  if (merchantName == null) {
    warnings.push("Kunde inte identifiera butik eller leverantor automatiskt.");
  }
  if (transactionDate == null) {
    warnings.push("Kunde inte hitta ett tydligt datum i kvittot.");
  }
  if (totalAmountOre == null) {
    warnings.push("Kunde inte hitta ett tydligt totalbelopp i kvittot.");
  }
  if (vatAmountOre != null && totalAmountOre != null && vatAmountOre >= totalAmountOre) {
    warnings.push(
      "Hittad moms ar orimligt hog i forhallande till totalbeloppet. Kontrollera manuellt.",
    );
  }

  return {
    sourceFilename: input.sourceFilename,
    mimeType: input.mimeType,
    extractedText: lines.join("\n").slice(0, 4000),
    confidence: Math.round(input.confidence),
    ...(merchantName != null && { merchantName }),
    ...(transactionDate != null && { transactionDate }),
    ...(totalAmountOre != null && { totalAmountOre }),
    ...(vatAmountOre != null && { vatAmountOre }),
    ...(currency != null && { currency }),
    suggestedDescription,
    prefillLines: buildPrefillLines(totalAmountOre, suggestedDescription),
    warnings,
  };
}

export class TesseractReceiptOcrService implements IReceiptOcrService {
  async analyze(input: ReceiptOcrInput): Promise<ReceiptOcrAnalysis> {
    if (!supportsReceiptOcrMimeType(input.mimeType)) {
      throw AppError.badRequest(
        "OCR stods just nu endast for JPG, PNG och WebP-bilder",
        "OCR_UNSUPPORTED_MIME",
      );
    }

    const langPath = process.env["OCR_LANG_PATH"];
    const worker = await createWorker(
      "eng",
      undefined,
      langPath != null
        ? {
            langPath,
          }
        : undefined,
    );

    try {
      const result = await worker.recognize(Buffer.from(input.buffer));
      return parseReceiptText({
        sourceFilename: input.filename,
        mimeType: input.mimeType,
        extractedText: result.data.text,
        confidence: result.data.confidence,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal("OCR-analysen misslyckades");
    } finally {
      await worker.terminate();
    }
  }
}
