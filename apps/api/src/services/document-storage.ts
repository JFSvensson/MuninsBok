/**
 * Local disk document storage.
 * Stores files under UPLOAD_DIR/<organizationId>/<storageKey>.
 */
import { mkdir, writeFile, readFile, unlink, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_UPLOAD_DIR = join(process.cwd(), "uploads");

export class DocumentStorage {
  private readonly uploadDir: string;

  constructor(uploadDir?: string) {
    this.uploadDir = uploadDir ?? process.env["UPLOAD_DIR"] ?? DEFAULT_UPLOAD_DIR;
  }

  /** Generate a unique storage key for a file. */
  generateStorageKey(organizationId: string, filename: string): string {
    const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
    return `${organizationId}/${randomUUID()}${ext}`;
  }

  /** Store file data and return the storage key. */
  async store(storageKey: string, data: Buffer): Promise<void> {
    const filePath = join(this.uploadDir, storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  /** Read file data by storage key. */
  async read(storageKey: string): Promise<Buffer> {
    const filePath = join(this.uploadDir, storageKey);
    return readFile(filePath);
  }

  /** Delete file by storage key. Returns true if file existed. */
  async remove(storageKey: string): Promise<boolean> {
    const filePath = join(this.uploadDir, storageKey);
    try {
      await access(filePath);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
