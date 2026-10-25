import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { MesaError } from "@/lib/mesa/data";
import { cancelMesaSend, scheduleMesaSend } from "@/lib/mesa/sends";

// CRM → Broadcasts → La Mesa: «Programar el envío» (an edition to a
// segment, at a day and time — the broadcasts' cron or QStash sends it
// then) and «Cancelar el envío» while it hasn't started.
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("schedule"), edition: z.number().int().min(1).max(10_000), segmentId: z.string().min(1), scheduledAt: z.string().datetime() }),
  z.object({ action: z.literal("cancel"), edition: z.number().int().min(1).max(10_000) }),
]);

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Revisa el segmento, el día y la hora." }, { status: 400 });
  try {
    const body = parsed.data;
    if (body.action === "cancel") {
      await cancelMesaSend(body.edition);
      return NextResponse.json({ ok: true });
    }
    const { id } = await scheduleMesaSend({ edition: body.edition, segmentId: body.segmentId, scheduledAt: new Date(body.scheduledAt) });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof MesaError) return NextResponse.json({ error: "mesa", message: error.message }, { status: 400 });
    console.error("la mesa: send", error);
    return NextResponse.json({ error: "error", message: "No se pudo: vuelve a intentarlo." }, { status: 500 });
  }
}
