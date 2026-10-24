import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { instructorInputSchema, uniqueInstructorSlug } from "@/lib/library/admin";

// A new instructor made by the team (Editar biblioteca → Instructoras):
// approved as it's made — only the profiles made in the portal wait for
// review.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = instructorInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const instructor = await db.instructor.create({
    data: { ...parsed.data, photoUrl: parsed.data.photoUrl ?? null, slug: await uniqueInstructorSlug(parsed.data.name), approvedAt: new Date() },
  });
  return NextResponse.json({ ok: true, instructor });
}
