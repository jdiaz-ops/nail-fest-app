import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateLink, deleteLink } from "@/lib/linkPage";
import { requireUser } from "@/lib/auth/guard";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  url: z.string().min(1).url().optional(),
  enabled: z.boolean().optional(),
  // "" means "clear the card background" — only applied when the field is
  // actually present in the body (see below); same convention as
  // OrgSettings' own image/video fields.
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { imageUrl, videoUrl, ...rest } = parsed.data;
  try {
    const link = await updateLink(params.id, {
      ...rest,
      ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
      ...(videoUrl !== undefined ? { videoUrl: videoUrl || null } : {}),
    });
    return NextResponse.json({ ok: true, link });
  } catch (err) {
    console.error("update link failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  try {
    await deleteLink(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete link failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
