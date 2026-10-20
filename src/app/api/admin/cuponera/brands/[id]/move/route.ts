import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { moveCuponeraBrand } from "@/lib/cuponera/admin";

const bodySchema = z.object({ direction: z.enum(["up", "down"]) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    await moveCuponeraBrand(params.id, parsed.data.direction);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("move cuponera brand failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
