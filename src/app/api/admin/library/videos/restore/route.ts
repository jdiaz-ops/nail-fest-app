import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { uniqueVideoSlug } from "@/lib/library/admin";

// «Deshacer» right after deleting a video in Editar biblioteca → Videos: the
// same video back, with its address when it's still free, and linked again
// to what it came from (YouTube, an instructor's submission). Its views
// before the delete don't come back.
const restoreSchema = z.object({
  video: z.object({
    id: z.string().min(1).max(60),
    slug: z.string().min(1).max(200),
    kind: z.enum(["video", "maraton"]),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).nullable(),
    theme: z.string().min(1).max(40),
    extraThemes: z.array(z.string().max(40)).max(5),
    subcategories: z.array(z.string().max(60)).max(5),
    level: z.string().max(40),
    youtubeId: z.string().min(1).max(40),
    durationSeconds: z.number().int().nullable(),
    // Deleted before it was kept (2026-10-25): asked to YouTube again.
    vertical: z.boolean().nullable().optional(),
    instructorId: z.string().max(60).nullable(),
    teachersNote: z.string().max(200).nullable(),
    products: z.array(z.unknown()).max(40),
    steps: z.array(z.string().max(400)).max(60),
    gated: z.boolean(),
    visible: z.boolean(),
    inShorties: z.boolean(),
    tags: z.array(z.string().max(80)).max(20),
    publishedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
  }),
  importId: z.string().max(60).nullable(),
  importDecidedBy: z.string().max(20).nullable(),
  submissionId: z.string().max(60).nullable(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = restoreSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { video, importId, importDecidedBy, submissionId } = parsed.data;
  const [idTaken, slugTaken, instructor] = await Promise.all([
    db.libraryVideo.findUnique({ where: { id: video.id }, select: { id: true } }),
    db.libraryVideo.findUnique({ where: { slug: video.slug }, select: { id: true } }),
    video.instructorId ? db.instructor.findUnique({ where: { id: video.instructorId }, select: { id: true } }) : null,
  ]);
  if (idTaken) return NextResponse.json({ error: "already_there" }, { status: 409 });
  const created = await db.libraryVideo.create({
    data: {
      ...video,
      slug: slugTaken ? await uniqueVideoSlug(video.title) : video.slug,
      instructorId: instructor ? video.instructorId : null,
      products: video.products as Prisma.InputJsonValue,
      publishedAt: new Date(video.publishedAt),
      createdAt: new Date(video.createdAt),
    },
  });
  await Promise.all([
    importId
      ? db.libraryYoutubeVideo.updateMany({ where: { id: importId, libraryVideoId: null }, data: { status: "ADDED", decidedBy: importDecidedBy === "ia" ? "ia" : "equipo", libraryVideoId: created.id } })
      : null,
    submissionId ? db.instructorVideoSubmission.updateMany({ where: { id: submissionId, videoId: null }, data: { videoId: created.id } }) : null,
  ]);
  return NextResponse.json({ ok: true, id: created.id });
}
