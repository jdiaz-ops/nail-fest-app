import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLink } from "@/lib/linkPage";
import { requireUser } from "@/lib/auth/guard";

const bodySchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1).url(),
  // "" (or omitted) means "no card background" — same "" = clear
  // convention as OrgSettings' own image/video fields.
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { imageUrl, videoUrl, ...rest } = parsed.data;
  const link = await createLink({ ...rest, imageUrl: imageUrl || null, videoUrl: videoUrl || null });
  return NextResponse.json({ ok: true, link });
}
