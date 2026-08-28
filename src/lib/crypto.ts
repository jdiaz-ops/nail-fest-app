import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// App-level encryption for secrets we have to store (the Meta System User
// token). This is deliberately NOT "encryption at rest via the disk" — it's
// so a DB dump or a leaked read replica doesn't hand over a usable token.
//
// Requires APP_SECRET_KEY in the environment: a long random string, e.g.
// `openssl rand -hex 32`. Never reuse this value across environments.

const ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "APP_SECRET_KEY is not set. Generate one with `openssl rand -hex 32` and add it to your environment before storing any secret."
    );
  }
  // scrypt with a fixed, non-secret salt is fine here: the secret itself is
  // high-entropy (we require operators to generate it with openssl), so this
  // is just KDF hygiene, not the source of security.
  return scryptSync(secret, "nail-fest-app.static-salt", 32);
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv.authTag.ciphertext, all base64 — self-contained, no separate column needed.
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const key = deriveKey();
  const [ivB64, authTagB64, ciphertextB64] = stored.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted secret — expected iv.authTag.ciphertext");
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
