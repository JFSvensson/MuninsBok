/**
 * Password hashing using Node.js built-in crypto.scrypt.
 *
 * Uses scrypt key derivation with a random 16-byte salt and 64-byte key.
 * Passwords are stored as `salt:hash` (hex-encoded).
 * Verification uses crypto.timingSafeEqual to prevent timing attacks.
 */
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_COST = 16384; // N = 2^14

interface ScryptOptions {
  readonly N: number;
  readonly r: number;
  readonly p: number;
  readonly maxmem: number;
}

const SCRYPT_OPTIONS: ScryptOptions = {
  N: SCRYPT_COST,
  r: 8,
  p: 1,
  maxmem: 128 * SCRYPT_COST * 8 * 2,
};

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Hash a plaintext password.
 * @returns A string in the format `salt:hash` (hex-encoded).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * @param password  The plaintext password to check.
 * @param stored    The stored `salt:hash` string from hashPassword().
 * @returns `true` if the password matches.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const storedHash = Buffer.from(hashHex, "hex");
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);

  if (derivedKey.length !== storedHash.length) return false;

  return timingSafeEqual(derivedKey, storedHash);
}
