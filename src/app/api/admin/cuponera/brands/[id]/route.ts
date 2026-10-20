import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { updateCuponeraBrand } from "@/lib/cuponera/admin";

const patchSchema = z
  .object({
    visible: z.boolean(),
    showCoupon: z.boolean(),
    couponTitle: z
      .string()
      .max(120)
      .nullable()
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    couponConditions: z
      .array(z.string().max(160))
      .max(8)
      .transform((list) => list.map((c) => c.trim()).filter(Boolean)),
    couponExclusive: z.boolean(),
  })
  .partial();

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const brand = await updateCuponeraBrand(params.id, parsed.data);
    return NextResponse.json({ ok: true, brand });
  } catch (err) {
    console.error("update cuponera brand failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
