import { createHmac } from "crypto";

function sign(personId: string): string {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) throw new Error("APP_SECRET_KEY is not set.");
  return createHmac("sha256", secret).update(`unsub.${personId}`).digest("base64url");
}

export function buildUnsubscribeUrl(personId: string): string {
  const token = `${personId}.${sign(personId)}`;
  return `${process.env.APP_BASE_URL ?? ""}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function verifyUnsubscribeToken(token: string): { valid: boolean; personId?: string } {
  const [personId, signature] = token.split(".");
  if (!personId || !signature) return { valid: false };
  if (signature !== sign(personId)) return { valid: false };
  return { valid: true, personId };
}
