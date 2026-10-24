import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { productRefOfLine, uniqueVideoSlug } from "@/lib/library/admin";

const bodySchema = z.object({ action: z.enum(["accept", "decline"]) });

// A video an instructor sent from her portal (Editar biblioteca → Videos →
// "Enviados por instructoras"): "Aceptar y editar" makes it a library video
// — hidden, with her ficha filled in, for the team to finish and switch
// on — and "No seleccionar" closes it. Her portal shows "Publicado" only
// once the video is visible. Nothing is sent to her.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const submission = await db.instructorVideoSubmission.findUnique({ where: { id: params.id } });
  if (!submission) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (submission.status !== "PENDING") return NextResponse.json({ error: "already_reviewed", message: "Este video ya se revisó." }, { status: 409 });
  const now = new Date();

  if (parsed.data.action === "decline") {
    await db.instructorVideoSubmission.updateMany({ where: { id: submission.id, status: "PENDING" }, data: { status: "DECLINED", reviewedAt: now } });
    return NextResponse.json({ ok: true });
  }

  const slug = await uniqueVideoSlug(submission.title);
  const videoId = await db.$transaction(async (tx) => {
    // Two teammates on the same video: only the first one makes it.
    const { count } = await tx.instructorVideoSubmission.updateMany({ where: { id: submission.id, status: "PENDING" }, data: { status: "PUBLISHED", reviewedAt: now } });
    if (count === 0) return null;
    const video = await tx.libraryVideo.create({
      data: {
        slug,
        title: submission.title,
        description: submission.description,
        theme: submission.theme,
        level: submission.level,
        youtubeId: submission.youtubeId,
        instructorId: submission.instructorId,
        products: submission.products.map(productRefOfLine) as unknown as Prisma.InputJsonValue,
        visible: false,
      },
    });
    await tx.instructorVideoSubmission.update({ where: { id: submission.id }, data: { videoId: video.id } });
    return video.id;
  });
  if (!videoId) return NextResponse.json({ error: "already_reviewed", message: "Este video ya se revisó." }, { status: 409 });
  return NextResponse.json({ ok: true, videoId });
}
