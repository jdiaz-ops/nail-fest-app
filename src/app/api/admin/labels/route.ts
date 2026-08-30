import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { getOrCreateLabel, listLabels } from "@/lib/labels";

export async function GET() {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ labels: await listLabels() });
}

const bodySchema = z.object({ name: z.string().min(1) });

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const label = await getOrCreateLabel(parsed.data.name);
  return NextResponse.json({ ok: true, label });
}
