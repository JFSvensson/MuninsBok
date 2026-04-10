import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, needsRehash } from "./password.js";

describe("password hashing", () => {
  it("hashPassword returns v2:salt:hash format", async () => {
    const hashed = await hashPassword("test-password");
    expect(hashed.startsWith("v2:")).toBe(true);
    const parts = hashed.slice(3).split(":");
    expect(parts).toHaveLength(2);
    // 16-byte salt → 32 hex chars, 64-byte hash → 128 hex chars
    expect(parts[0]).toHaveLength(32);
    expect(parts[1]).toHaveLength(128);
  });

  it("hashPassword produces unique hashes for same password", async () => {
    const hash1 = await hashPassword("same-password");
    const hash2 = await hashPassword("same-password");
    expect(hash1).not.toBe(hash2);
  });

  it("verifyPassword returns true for correct password", async () => {
    const hashed = await hashPassword("correct-password");
    const result = await verifyPassword("correct-password", hashed);
    expect(result).toBe(true);
  });

  it("verifyPassword returns false for wrong password", async () => {
    const hashed = await hashPassword("correct-password");
    const result = await verifyPassword("wrong-password", hashed);
    expect(result).toBe(false);
  });

  it("verifyPassword returns false for malformed stored hash", async () => {
    expect(await verifyPassword("any", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("any", "")).toBe(false);
  });

  it("handles unicode passwords", async () => {
    const hashed = await hashPassword("lösenörd-åäö-🔑");
    expect(await verifyPassword("lösenörd-åäö-🔑", hashed)).toBe(true);
    expect(await verifyPassword("losenord-aao", hashed)).toBe(false);
  });

  it("needsRehash returns false for v2 hashes", async () => {
    const hashed = await hashPassword("test-password");
    expect(needsRehash(hashed)).toBe(false);
  });

  it("needsRehash returns true for legacy v1 hashes", () => {
    // Legacy format: salt:hash (no v2 prefix)
    const legacyHash = "a".repeat(32) + ":" + "b".repeat(128);
    expect(needsRehash(legacyHash)).toBe(true);
  });

  it("verifies legacy v1 format hashes", async () => {
    // Simulate a v1 hash (N=2^14): manually create one using legacy params
    const { scrypt, randomBytes } = await import("node:crypto");
    const salt = randomBytes(16);
    const key = await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        "legacy-password",
        salt,
        64,
        { N: 16384, r: 8, p: 1, maxmem: 128 * 16384 * 8 * 2 },
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        },
      );
    });
    const legacyHash = `${salt.toString("hex")}:${key.toString("hex")}`;

    expect(await verifyPassword("legacy-password", legacyHash)).toBe(true);
    expect(await verifyPassword("wrong-password", legacyHash)).toBe(false);
    expect(needsRehash(legacyHash)).toBe(true);
  });
});
