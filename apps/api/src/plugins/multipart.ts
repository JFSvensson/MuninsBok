/**
 * Minimal multipart/form-data support — replaces @fastify/multipart for this
 * API's single use case: `request.file()` returning the first uploaded file
 * as a buffered object. Files here are receipts (PDF/images, max 10 MB), so
 * buffering in memory matches the previous behaviour (`file.toBuffer()`).
 */
import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

export interface UploadedFile {
  filename: string;
  mimetype: string;
  data: Buffer;
  /** Returns the buffered file data (same API as @fastify/multipart). */
  toBuffer: () => Promise<Buffer>;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Returns the first uploaded file, or undefined when the request has none. */
    file: () => Promise<UploadedFile | undefined>;
  }
}

export interface MultipartOptions {
  limits?: { fileSize?: number };
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

function extractBoundary(contentType: string): string | undefined {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return match?.[1] ?? match?.[2];
}

function parseContentDisposition(header: string): { filename?: string } {
  const match = /filename="([^"]*)"/i.exec(header);
  const filename = match?.[1];
  return filename === undefined ? {} : { filename };
}

/** Split a buffer on a boundary sequence and return the parts. */
function splitBuffer(buf: Buffer, boundary: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  for (;;) {
    const idx = buf.indexOf(boundary, start);
    if (idx === -1) break;
    if (idx > start) parts.push(buf.subarray(start, idx));
    start = idx + boundary.length;
  }
  return parts;
}

function parsePart(part: Buffer): UploadedFile | undefined {
  // Headers end at the first CRLFCRLF
  const headerEnd = part.indexOf("\r\n\r\n");
  if (headerEnd === -1) return undefined;

  const headerText = part.subarray(0, headerEnd).toString("latin1");
  const headers = new Map<string, string>();
  for (const line of headerText.split("\r\n")) {
    const colon = line.indexOf(":");
    if (colon > 0)
      headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }

  const disposition = headers.get("content-disposition");
  if (!disposition) return undefined;
  const { filename } = parseContentDisposition(disposition);
  if (filename === undefined) return undefined; // form field, not a file

  // Body runs to the trailing CRLF before the next boundary
  let body = part.subarray(headerEnd + 4);
  if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
    body = body.subarray(0, body.length - 2);
  }

  return {
    filename,
    mimetype: headers.get("content-type") ?? "application/octet-stream",
    data: body,
    toBuffer: async () => body,
  };
}

const multipartPlugin: FastifyPluginAsync<MultipartOptions> = async (fastify, options) => {
  const maxFileSize = options.limits?.fileSize ?? DEFAULT_MAX_FILE_SIZE;

  // Accept multipart bodies without Fastify parsing them (request.file()
  // streams the raw body itself). Returning undefined marks body as "empty".
  fastify.addContentTypeParser("multipart/form-data", (_request, _payload, done) => {
    done(null, undefined);
  });

  fastify.decorateRequest("file", async function (this: FastifyRequest) {
    const contentType = this.headers["content-type"] ?? "";
    const boundary = extractBoundary(contentType);
    if (!contentType.toLowerCase().startsWith("multipart/form-data") || !boundary) {
      return undefined;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of this.raw) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > maxFileSize) {
        throw new Error(`Filen är för stor (max ${Math.round(maxFileSize / 1024 / 1024)} MB)`);
      }
      chunks.push(buf);
    }

    const parts = splitBuffer(Buffer.concat(chunks), Buffer.from(`--${boundary}`));
    for (const part of parts) {
      const file = parsePart(part);
      if (file) return file;
    }
    return undefined;
  });
};

export default fp(multipartPlugin, { name: "multipart" });
