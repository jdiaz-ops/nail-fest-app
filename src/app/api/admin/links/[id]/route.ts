import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateLink, deleteLink } from "@/lib/linkPage";
import { requireUser } from "@/lib/auth/guard";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  url: z.string().min(1).url().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const link = await updateLink(params.id, parsed.data);
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
