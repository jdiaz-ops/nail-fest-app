import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { updateLibrarySettings } from "@/lib/library/settings";
import { AUTOPILOT_MODEL, runAutopilot } from "@/lib/library/youtubeAutopilot";
import { autopilotSchema } from "@/lib/library/youtubeImport";

// Editar biblioteca → YouTube → Piloto automático: a round of the autopilot
// (three requests to Claude at the same time) that the tab asks for again
// and again while it's open, to show how it goes; its switch; and Claude's
// key, when Vercel has none.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, ...(await runAutopilot({ lanes: 3, budgetMs: 25_000 })) });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = autopilotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { autopilot, claudeKey } = parsed.data;
  if (claudeKey) {
    // Saved once Claude says it works.
    try {
      await new Anthropic({ apiKey: claudeKey, maxRetries: 1, timeout: 20_000 }).models.retrieve(AUTOPILOT_MODEL);
    } catch (error) {
      const message =
        error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError
          ? "Esa llave de Claude no sirve: revisa que esté bien copiada (empieza por «sk-ant-»)."
          : error instanceof Anthropic.NotFoundError
            ? "Esa cuenta de Claude no tiene acceso al modelo que usa la IA."
            : "No pudimos hablar con Claude para revisar la llave. Vuelve a intentarlo en un momento.";
      return NextResponse.json({ error: "claude_key", message }, { status: 400 });
    }
  }
  await updateLibrarySettings({
    ...(autopilot !== undefined ? { youtubeAutopilot: autopilot } : {}),
    ...(claudeKey !== undefined ? { claudeApiKey: claudeKey || null } : {}),
  });
  return NextResponse.json({ ok: true });
}
