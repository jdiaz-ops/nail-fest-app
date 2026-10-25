import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { videoInputSchema } from "@/lib/library/admin";

// Edit a video (the whole form, or one thing: its "visible" switch, its
// themes, its subcategory) or delete it — in one tap, with what's needed to
// undo it (api/admin/library/videos/restore). The address (slug) stays as
// it was born, so shared links keep working.
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
  if (rest.subcategories?.length && (await db.librarySubcategory.count({ where: { key: { in: rest.subcategories } } })) !== rest.subcategories.length) {
    return NextResponse.json({ error: "unknown_subcategory" }, { status: 400 });
  }
  if (rest.extraThemes) {
    // Never its main theme again among the others.
    const main = rest.theme ?? (await db.libraryVideo.findUnique({ where: { id: params.id }, select: { theme: true } }))?.theme;
    rest.extraThemes = [...new Set(rest.extraThemes.filter((t) => t !== main))];
  }
  const data: Prisma.LibraryVideoUncheckedUpdateInput = { ...rest };
  if (youtube !== undefined) {
    data.youtubeId = youtube;
    // Another video: its shape is asked to YouTube again (fillOrientations).
    const current = await db.libraryVideo.findUnique({ where: { id: params.id }, select: { youtubeId: true } });
    if (current && current.youtubeId !== youtube) data.vertical = null;
  }
  if (duration !== undefined) data.durationSeconds = duration;
  if (products !== undefined) data.products = products as unknown as Prisma.InputJsonValue;
  const updated = await db.libraryVideo.updateMany({ where: { id: params.id }, data });
  if (updated.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const video = await db.libraryVideo.findUnique({
    where: { id: params.id },
    include: { youtubeImport: { select: { id: true, decidedBy: true } }, submission: { select: { id: true } } },
  });
  if (!video) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { youtubeImport, submission, ...row } = video;
  await db.$transaction([
    db.libraryVideo.delete({ where: { id: video.id } }),
    // Brought from YouTube: it stays among «Descartados», where it can come back.
    ...(youtubeImport ? [db.libraryYoutubeVideo.update({ where: { id: youtubeImport.id }, data: { status: "DISCARDED", decidedBy: "equipo" } })] : []),
  ]);
  return NextResponse.json({
    ok: true,
    restore: { video: row, importId: youtubeImport?.id ?? null, importDecidedBy: youtubeImport?.decidedBy ?? null, submissionId: submission?.id ?? null },
  });
}
