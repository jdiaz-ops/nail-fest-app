import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLink } from "@/lib/linkPage";
import { requireUser } from "@/lib/auth/guard";

const bodySchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1).url(),
  textAlign: z.enum(["LEFT", "CENTER", "RIGHT"]).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const link = await createLink(parsed.data);
  return NextResponse.json({ ok: true, link });
}
