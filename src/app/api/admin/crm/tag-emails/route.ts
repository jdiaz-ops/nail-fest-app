import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { addPeopleToLabel } from "@/lib/labels";

// Same chunk size as the rest of this app's own bulk-email-list code
// (lib/broadcasts.ts's CHUNK_SIZE, suppress-emails' own copy).
const CHUNK_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// The positive counterpart to /api/admin/crm/suppress-emails — turns an
// external engagement list (e.g. "who opened a Brevo campaign in the
// last 2 months") into a Label the segment builder can target directly,
// same mechanism the per-broadcast "Abrió" tagging uses
// (lib/labels.ts's addPeopleToLabel). Matches by email against existing
// Person rows only — never creates new contacts.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const rawEmails: unknown = body?.emails;
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!Array.isArray(rawEmails)) {
    return NextResponse.json({ error: "missing_emails" }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "missing_label" }, { status: 400 });
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

  await addPeopleToLabel(label, matchedIds);

  return NextResponse.json({
    ok: true,
    label,
    submitted: normalized.length,
    matched: matchedIds.length,
    notFound: normalized.length - matchedIds.length,
  });
}
