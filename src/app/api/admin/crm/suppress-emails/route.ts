import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { revokeConsentBulk } from "@/lib/consent";

// Same chunk size as the rest of this app's own bulk-email-list code
// (lib/broadcasts.ts's CHUNK_SIZE) — an IN-list of a few thousand emails
// is fine for Postgres in one query, but staying consistent beats
// re-deriving a number.
const CHUNK_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Imports an external suppression list — e.g. a previous ESP's own
// export of soft-bounced/hard-bounced/unsubscribed contacts, from before
// this app or Resend ever sent this list a single email. Matches by
// email against existing Person rows (never creates new ones — this is
// suppression, not an import of new contacts) and revokes their
// MARKETING consent via the exact same mechanism lib/email/tracking.ts's
// own bounce/complaint auto-suppression uses, so every future Difusión
// (already gated on bulkActiveConsent(..., "MARKETING")) skips them
// automatically — no separate suppression list to maintain or remember
// to check.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const rawEmails: unknown = body?.emails;
  if (!Array.isArray(rawEmails)) {
    return NextResponse.json({ error: "missing_emails" }, { status: 400 });
  }

  const normalized = [
    ...new Set(
      rawEmails
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0)
    ),
  ];
  if (normalized.length === 0) {
    return NextResponse.json({ error: "no_valid_emails" }, { status: 400 });
  }

  const matchedIds: string[] = [];
  for (const emailChunk of chunk(normalized, CHUNK_SIZE)) {
    const rows = await db.person.findMany({ where: { email: { in: emailChunk } }, select: { id: true } });
    matchedIds.push(...rows.map((r) => r.id));
  }

  for (const idChunk of chunk(matchedIds, CHUNK_SIZE)) {
    await revokeConsentBulk(idChunk, "MARKETING");
  }

  return NextResponse.json({
    ok: true,
    submitted: normalized.length,
    matched: matchedIds.length,
    notFound: normalized.length - matchedIds.length,
  });
}
