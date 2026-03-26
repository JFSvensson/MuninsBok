import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { DocumentStorage } from "./document-storage.js";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("DocumentStorage", () => {
  let uploadDir: string;
  let storage: DocumentStorage;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), "muninsbok-test-"));
    storage = new DocumentStorage(uploadDir);
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  describe("generateStorageKey", () => {
    it("includes organization id and preserves file extension", () => {
      const key = storage.generateStorageKey("org-1", "receipt.pdf");

      expect(key).toMatch(/^org-1\//);
      expect(key).toMatch(/\.pdf$/);
    });

    it("handles filenames without extension", () => {
      const key = storage.generateStorageKey("org-1", "README");

      expect(key).toMatch(/^org-1\//);
      expect(key).not.toContain(".");
    });

    it("generates unique keys for the same input", () => {
      const key1 = storage.generateStorageKey("org-1", "file.pdf");
      const key2 = storage.generateStorageKey("org-1", "file.pdf");

      expect(key1).not.toBe(key2);
    });
  });

  describe("store + read roundtrip", () => {
    it("writes and reads file data correctly", async () => {
      const data = new TextEncoder().encode("hello world");
      const key = storage.generateStorageKey("org-1", "test.txt");

      await storage.store(key, data);
      const result = await storage.read(key);

      expect(Buffer.from(result).toString()).toBe("hello world");
    });

    it("creates nested directories automatically", async () => {
      const data = new Uint8Array([1, 2, 3]);
      const key = "org-deep/sub/file.bin";

      await storage.store(key, data);
      const result = await storage.read(key);

      expect(Array.from(result)).toEqual([1, 2, 3]);
    });
  });

  describe("remove", () => {
    it("returns true and deletes existing file", async () => {
      const data = new Uint8Array([42]);
      const key = storage.generateStorageKey("org-1", "temp.bin");
      await storage.store(key, data);

      const removed = await storage.remove(key);

      expect(removed).toBe(true);
      await expect(storage.read(key)).rejects.toThrow();
    });

    it("returns false for non-existent file", async () => {
      const removed = await storage.remove("org-1/nonexistent.pdf");

      expect(removed).toBe(false);
    });
  });
});
