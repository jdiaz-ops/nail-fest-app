import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAsistireUse } from "@/lib/asistireUse";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1).max(300),
  step: z.enum(["CREATED", "DOWNLOADED"]),
  visitor: z.string().max(64).nullable().optional(),
});

// «Asistiré»'s count (2026-11-01, lib/asistireUse.ts): her page says when she made her image and when she took it.
// Her link's token says whose it is; nothing of her photo is sent, and nothing comes back.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { token, step, visitor } = parsed.data;
  const result = await recordAsistireUse(token, step, visitor ?? null);
  if (result === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (result === "invalid_visitor") return NextResponse.json({ error: "invalid_visitor" }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
