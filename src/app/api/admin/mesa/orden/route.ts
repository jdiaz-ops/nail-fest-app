import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { MesaError, saveEditionLayout } from "@/lib/mesa/data";
import { MESA_BLOCKS } from "@/lib/mesa/layout";

// La Mesa → an edition's card (2026-11-04): «Subir» and «Bajar» on its
// blocks, and Manicuristas Imparables' banner on or off — until it starts
// going out (lib/mesa/layout.ts).
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  edition: z.number().int().min(1),
  blocks: z.array(z.enum(MESA_BLOCKS)).max(MESA_BLOCKS.length).optional(),
  imparables: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "No se entendió el cambio." }, { status: 400 });
  const { edition, blocks, imparables } = parsed.data;
  try {
    await saveEditionLayout(edition, { blocks, imparables });
  } catch (error) {
    if (!(error instanceof MesaError)) throw error;
    return NextResponse.json({ error: "mesa", message: error.message }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
