import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { updateCuponeraSettings } from "@/lib/cuponera/settings";

const optionalText = z
  .string()
  .max(300)
  .nullable()
  .transform((v) => (v && v.trim() ? v.trim() : null));

const patchSchema = z
  .object({
    published: z.boolean(),
    heroTitle: optionalText,
    heroLede: optionalText,
    showDeal: z.boolean(),
    showCoupons: z.boolean(),
    showNew: z.boolean(),
    newTitle: optionalText,
    newSubtitle: optionalText,
    newDays: z.number().int().min(1).max(365),
    dealProductId: z.string().min(1).nullable(),
    dealEndsAt: z
      .string()
      .nullable()
      .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "invalid date")
      .transform((v) => (v ? new Date(v) : null)),
  })
  .partial();

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const settings = await updateCuponeraSettings(parsed.data);
  return NextResponse.json({ ok: true, settings });
}
