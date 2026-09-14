import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { revokeConsentBulk } from "@/lib/consent";

const CHUNK_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Revokes WHATSAPP consent for a list of Person ids — used for the
// phone-country-fix tool's "needs review" bucket (genuinely can't tell
// what these numbers are, so they shouldn't keep costing a wasted send
// attempt every broadcast). Takes ids directly rather than matching by
// phone number — a malformed/ambiguous phone can't reliably be matched
// back to exactly one Person, personId always can. Never touches
// MARKETING/ADVERTISING/LOGISTICS.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const rawIds: unknown = body?.personIds;
  if (!Array.isArray(rawIds)) {
    return NextResponse.json({ error: "missing_person_ids" }, { status: 400 });
  }

  const personIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (personIds.length === 0) {
    return NextResponse.json({ error: "no_valid_ids" }, { status: 400 });
  }

  for (const idChunk of chunk(personIds, CHUNK_SIZE)) {
    await revokeConsentBulk(idChunk, "WHATSAPP");
  }

  return NextResponse.json({ ok: true, matched: personIds.length });
}
