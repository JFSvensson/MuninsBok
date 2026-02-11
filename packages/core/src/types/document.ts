/**
 * Document - ett bifogat dokument (kvitto, faktura, etc.).
 */
export interface Document {
  readonly id: string;
  readonly organizationId: string;
  /** Kopplat verifikat-ID om tillämpligt */
  readonly voucherId?: string;
  /** Ursprungligt filnamn */
  readonly filename: string;
  /** MIME-typ */
  readonly mimeType: string;
  /** Nyckel för lagring (filepath, S3 key, etc.) */
  readonly storageKey: string;
  /** Filstorlek i bytes */
  readonly size: number;
  readonly createdAt: Date;
}

export interface CreateDocumentInput {
  readonly organizationId: string;
  readonly voucherId?: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly storageKey: string;
  readonly size: number;
}

export interface DocumentError {
  readonly code: "INVALID_FILENAME" | "INVALID_MIME_TYPE" | "NOT_FOUND";
  readonly message: string;
}

/** Allowed MIME types for documents */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Check if MIME type is allowed */
export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}
