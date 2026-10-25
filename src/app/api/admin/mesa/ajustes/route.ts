import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { updateLibrarySettings } from "@/lib/library/settings";
import { MESA_MODEL } from "@/lib/mesa/ai";
import { setFirstEditionOn } from "@/lib/mesa/data";

// La Mesa's settings: the day of edition 1 (a Thursday; the rest follow
// every 14 days) and Claude's key when Vercel has none — the same one the
// YouTube autopilot used, saved once Claude says it works.
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    firstEditionOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    claudeKey: z.string().trim().max(300),
  })
  .partial();

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { firstEditionOn, claudeKey } = parsed.data;

  if (firstEditionOn) {
    const day = new Date(`${firstEditionOn}T00:00:00Z`);
    if (Number.isNaN(day.getTime())) return NextResponse.json({ error: "date", message: "Esa fecha no existe." }, { status: 400 });
    if (day.getUTCDay() !== 4) return NextResponse.json({ error: "date", message: "La Mesa sale los jueves: elige un jueves." }, { status: 400 });
    await setFirstEditionOn(day);
  }
  if (claudeKey) {
    try {
      await new Anthropic({ apiKey: claudeKey, maxRetries: 1, timeout: 20_000 }).models.retrieve(MESA_MODEL);
    } catch (error) {
      const message =
        error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError
          ? "Esa llave de Claude no sirve: revisa que esté bien copiada (empieza por «sk-ant-»)."
          : error instanceof Anthropic.NotFoundError
            ? "Esa cuenta de Claude no tiene acceso al modelo que usa la IA."
            : "No pudimos hablar con Claude para revisar la llave. Vuelve a intentarlo en un momento.";
      return NextResponse.json({ error: "claude_key", message }, { status: 400 });
    }
    await updateLibrarySettings({ claudeApiKey: claudeKey });
  }
  return NextResponse.json({ ok: true });
}
