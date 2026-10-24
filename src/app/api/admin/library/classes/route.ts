import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { classInputSchema } from "@/lib/library/admin";

// A new class on an instructor's profile (Editar biblioteca → Clases).
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = classInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  if (!(await db.instructor.findUnique({ where: { id: parsed.data.instructorId }, select: { id: true } }))) {
    return NextResponse.json({ error: "unknown_instructor" }, { status: 400 });
  }
  const created = await db.instructorClass.create({ data: parsed.data });
  return NextResponse.json({ ok: true, class: created });
}
