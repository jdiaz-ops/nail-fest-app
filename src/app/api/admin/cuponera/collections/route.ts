import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { saveCollectionMapping } from "@/lib/cuponera/admin";
import { CATEGORY_KEYS, collectionKey, isSubcategoryOf, type CuponeraCategory } from "@/lib/cuponera/shared";

// The unifier in /admin/cuponera: map brand collections to a category (one
// row or all the suggestions at once), ignore them, or clear the mapping.
// The key is always worked out here from the name, never trusted from the
// client.
const itemSchema = z
  .object({
    label: z.string().min(1).max(200),
    category: z.enum(CATEGORY_KEYS as [CuponeraCategory, ...CuponeraCategory[]]).nullable().default(null),
    subcategory: z.string().max(40).nullable().default(null),
    ignored: z.boolean().default(false),
    clear: z.boolean().default(false),
  })
  .refine((i) => i.clear || i.ignored || i.category !== null, "pick a category, ignore or clear")
  .refine((i) => i.subcategory === null || (i.category !== null && isSubcategoryOf(i.category, i.subcategory)), "subcategory outside its category");

const bodySchema = z.object({ items: z.array(itemSchema).min(1).max(1000) });

export async function PUT(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  let saved = 0;
  for (const item of parsed.data.items) {
    const key = collectionKey(item.label);
    if (!key) continue;
    await saveCollectionMapping(key, item.label, item.clear ? null : { category: item.category, subcategory: item.subcategory, ignored: item.ignored });
    saved++;
  }
  return NextResponse.json({ ok: true, saved });
}
