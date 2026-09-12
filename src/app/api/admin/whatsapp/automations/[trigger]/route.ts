import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AutomationFormatScope, WhatsAppAutomationTrigger } from "@prisma/client";
import { requireUser } from "@/lib/auth/guard";
import {
  AUTOMATION_TRIGGER_LIST,
  AutomationValidationError,
  deleteAutomation,
  setAutomationEnabled,
  upsertAutomation,
} from "@/lib/whatsapp/automations";

function parseTrigger(raw: string): WhatsAppAutomationTrigger | null {
  return (AUTOMATION_TRIGGER_LIST as string[]).includes(raw) ? (raw as WhatsAppAutomationTrigger) : null;
}

// formatScope is passed as a query param (?scope=VIRTUAL), not a second
// path segment — keeps the existing /automations/[trigger] URL shape
// intact for the DEFAULT case (the vast majority of calls, and every
// existing bookmark/integration), while still letting the DEFAULT vs.
// VIRTUAL override (see AutomationFormatScope's own schema comment) be
// addressed independently.
function parseScope(raw: string | null): AutomationFormatScope {
  return raw === "VIRTUAL" ? "VIRTUAL" : "DEFAULT";
}

// Picks (or repoints) the template for one automation — always comes back
// enabled, same "picking a template activates it" reasoning as
// upsertAutomation's own comment.
const putSchema = z.object({ templateId: z.string().min(1) });

export async function PUT(req: NextRequest, { params }: { params: { trigger: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const trigger = parseTrigger(params.trigger);
  if (!trigger) return NextResponse.json({ error: "unknown_trigger" }, { status: 404 });
  const formatScope = parseScope(req.nextUrl.searchParams.get("scope"));

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const automation = await upsertAutomation(trigger, parsed.data.templateId, formatScope);
    return NextResponse.json({ ok: true, automation });
  } catch (err) {
    if (err instanceof AutomationValidationError) {
      return NextResponse.json({ error: "validation_failed", message: err.message }, { status: 400 });
    }
    throw err;
  }
}

// Turns an already-configured automation on/off without losing which
// template it's paired with — the "necesito poder desactivar" control.
const patchSchema = z.object({ enabled: z.boolean() });

export async function PATCH(req: NextRequest, { params }: { params: { trigger: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const trigger = parseTrigger(params.trigger);
  if (!trigger) return NextResponse.json({ error: "unknown_trigger" }, { status: 404 });
  const formatScope = parseScope(req.nextUrl.searchParams.get("scope"));

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const automation = await setAutomationEnabled(trigger, parsed.data.enabled, formatScope).catch(() => null);
  if (!automation) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  return NextResponse.json({ ok: true, automation });
}

// Removes the pairing entirely — back to "not configured" (see
// deleteAutomation's own comment on how that differs from PATCH
// {enabled:false}).
export async function DELETE(req: NextRequest, { params }: { params: { trigger: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const trigger = parseTrigger(params.trigger);
  if (!trigger) return NextResponse.json({ error: "unknown_trigger" }, { status: 404 });
  const formatScope = parseScope(req.nextUrl.searchParams.get("scope"));

  await deleteAutomation(trigger, formatScope);
  return NextResponse.json({ ok: true });
}
