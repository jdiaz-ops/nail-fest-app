import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSegment } from "@/lib/segments/builder";
import { filterSchema } from "@/lib/segments/schema";
import { requireUser } from "@/lib/auth/guard";

// Live count while building a filter in /admin/segments (and the
// broadcast composer) — before saving anything. Reuses the same
// resolveSegment() the real sync/broadcast paths use, so the number shown
// here is exactly who'd actually be included, not an approximation.

const bodySchema = z.object({ filter: filterSchema });

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const people = await resolveSegment(parsed.data.filter);
  return NextResponse.json({ count: people.length });
}
