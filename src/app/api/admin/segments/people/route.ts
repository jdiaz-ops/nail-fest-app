import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { personSearchWhere } from "@/lib/segments/personSearch";

// Feeds SegmentComposer's "Personas específicas" field (the `person`
// segment condition — see lib/segments/normalize.ts):
//   GET ?q=313 241 — people whose phone, email or name matches, for the
//                    search box (see personSearchWhere for the rules)
//   POST {ids}     — the people a saved segment already holds, so editing
//                    it shows them as chips again (a segment only stores
//                    their ids). POST rather than ?ids= since a hand-built
//                    list has no natural cap that keeps a URL short.

const SEARCH_LIMIT = 8;

const personFields = { id: true, firstName: true, lastName: true, email: true, phone: true, city: true } as const;

export async function GET(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const where = personSearchWhere(req.nextUrl.searchParams.get("q") ?? "");
  if (!where) return NextResponse.json({ people: [] });

  const people = await db.person.findMany({
    where,
    select: personFields,
    orderBy: { createdAt: "desc" },
    take: SEARCH_LIMIT,
  });
  return NextResponse.json({ people });
}

const lookupSchema = z.object({ ids: z.array(z.string()).max(5000) });

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = lookupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { ids } = parsed.data;
  if (ids.length === 0) return NextResponse.json({ people: [] });

  const people = await db.person.findMany({ where: { id: { in: ids } }, select: personFields });
  return NextResponse.json({ people });
}
