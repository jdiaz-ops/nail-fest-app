import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { MesaError } from "@/lib/mesa/data";
import { sendMesaTest } from "@/lib/mesa/sends";

// La Mesa → «Enviarme una prueba»: the edition to one
// address, its subject starting with [Prueba]; its votes record nothing.
export const dynamic = "force-dynamic";

const bodySchema = z.object({ edition: z.number().int().min(1).max(10_000), email: z.string().trim().email() });

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Escribe un correo válido." }, { status: 400 });
  try {
    await sendMesaTest(parsed.data.edition, parsed.data.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MesaError) return NextResponse.json({ error: "mesa", message: error.message }, { status: 400 });
    console.error("la mesa: test send", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "send_failed", message: `No se pudo enviar la prueba: ${detail}` }, { status: 502 });
  }
}
