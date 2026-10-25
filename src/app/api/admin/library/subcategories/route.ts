import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { createSubcategory, subcategoryInputSchema } from "@/lib/library/subcategories";

// Editar biblioteca → Videos: a subcategory the team makes (Navidad,
// Halloween…) — or the one there is with that name.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = subcategoryInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const sub = await createSubcategory(parsed.data);
  return NextResponse.json({ ok: true, subcategory: { id: sub.id, key: sub.key, name: sub.name, theme: sub.theme } });
}
