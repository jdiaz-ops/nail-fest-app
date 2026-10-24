import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { uniqueVideoSlug, videoInputSchema } from "@/lib/library/admin";

// A new video or recording in the library (Editar biblioteca → Videos).
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = videoInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { youtube, duration, products, ...rest } = parsed.data;
  if (rest.instructorId && !(await db.instructor.findUnique({ where: { id: rest.instructorId }, select: { id: true } }))) {
    return NextResponse.json({ error: "unknown_instructor" }, { status: 400 });
  }
  const video = await db.libraryVideo.create({
    data: {
      ...rest,
      instructorId: rest.instructorId ?? null,
      slug: await uniqueVideoSlug(rest.title),
      youtubeId: youtube,
      durationSeconds: duration,
      products: products as unknown as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({ ok: true, video });
}
