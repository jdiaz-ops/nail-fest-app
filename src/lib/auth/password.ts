import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Node's built-in scrypt — no new dependency (bcrypt/argon2 would mean a
// native-binary dep for a small internal admin tool). Stored format is
// "scrypt:<salt-hex>:<hash-hex>" so the scheme is self-describing if it
// ever needs to change later without breaking existing rows.

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(plain, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, salt, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;
  const derived = (await scrypt(plain, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  // Constant-time compare — a plain === would leak how many leading bytes
  // matched via response timing. Lengths must match before calling
  // timingSafeEqual (it throws on a mismatch instead of returning false).
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
