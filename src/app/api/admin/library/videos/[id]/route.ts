import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { videoInputSchema } from "@/lib/library/admin";

// Edit a video (the whole form, or just its "visible" switch) or delete it.
// The address (slug) stays as it was born, so shared links keep working.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = videoInputSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { youtube, duration, products, ...rest } = parsed.data;
  if (rest.instructorId && !(await db.instructor.findUnique({ where: { id: rest.instructorId }, select: { id: true } }))) {
    return NextResponse.json({ error: "unknown_instructor" }, { status: 400 });
  }
  const data: Prisma.LibraryVideoUncheckedUpdateInput = { ...rest };
  if (youtube !== undefined) data.youtubeId = youtube;
  if (duration !== undefined) data.durationSeconds = duration;
  if (products !== undefined) data.products = products as unknown as Prisma.InputJsonValue;
  const updated = await db.libraryVideo.updateMany({ where: { id: params.id }, data });
  if (updated.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const deleted = await db.libraryVideo.deleteMany({ where: { id: params.id } });
  if (deleted.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
