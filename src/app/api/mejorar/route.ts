import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UPGRADE_PAGE } from "@/lib/imparables/tiers";
import { startUpgrade, upgradeRegistrationId } from "@/lib/imparables/tiersServer";

// Her payment for the difference to a higher ticket level (lib/imparables/
// tiers.ts, 2026-10-31), from her page nailfest.lat/mejorar/<her link>: only
// with her signed link, at the price worked out here, in pesos through Wompi.
const bodySchema = z.object({ token: z.string().min(10).max(200), tier: z.enum(["circulo", "elite"]) });

const MESSAGES: Record<string, string> = {
  not_found: "Este enlace no es de una compra que pueda cambiar de nivel.",
  not_higher: "Ya tienes ese nivel o uno más alto.",
  sold_out: "Ese nivel ya no tiene cupos.",
  usd: UPGRADE_PAGE.usd,
  tickets: UPGRADE_PAGE.tickets,
  nothing_to_pay: "No hay diferencia por pagar: escríbenos por WhatsApp y lo hacemos contigo.",
};

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const registrationId = upgradeRegistrationId(parsed.data.token);
  if (!registrationId) return NextResponse.json({ error: "not_found", message: MESSAGES.not_found }, { status: 404 });
  const started = await startUpgrade(registrationId, parsed.data.tier);
  if (!started.ok) return NextResponse.json({ error: started.error, message: MESSAGES[started.error] }, { status: 409 });
  return NextResponse.json({ ok: true, checkoutUrl: started.checkoutUrl, wompi: started.wompi });
}
