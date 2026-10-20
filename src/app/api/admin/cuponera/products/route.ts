import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { updateCuponeraProducts } from "@/lib/cuponera/admin";
import { CATEGORY_KEYS, PROFESSION_KEYS, type CuponeraCategory, type CuponeraProfession } from "@/lib/cuponera/shared";

// One product (a row's own controls) or many at once (the selection bar) —
// same curation fields either way.
const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(5000),
  patch: z
    .object({
      visible: z.boolean(),
      featured: z.boolean(),
      category: z.enum(CATEGORY_KEYS as [CuponeraCategory, ...CuponeraCategory[]]).nullable(),
      professions: z.array(z.enum(PROFESSION_KEYS as [CuponeraProfession, ...CuponeraProfession[]])),
      isNew: z.boolean().nullable(),
    })
    .partial()
    .refine((p) => Object.keys(p).length > 0, "empty patch"),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { ids, patch } = parsed.data;
  const count = await updateCuponeraProducts(ids, {
    ...patch,
    ...(patch.professions ? { professions: [...new Set(patch.professions)] } : {}),
  });
  return NextResponse.json({ ok: true, count });
}
