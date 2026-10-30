import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { stepSchema } from "@/lib/sequences/save";
import { sendStep } from "@/lib/sequences/send";
import { describeWhatsAppSendError } from "@/lib/whatsapp/failureCategories";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  step: stepSchema,
  eventId: z.string().nullish(),
  sequenceName: z.string().max(120).optional(),
  /** Emails separated by commas, for an email step; a WhatsApp number, for a WhatsApp one. */
  to: z.string().trim().min(3).max(500),
});

// «Enviar prueba» on a sequence's step (2026-10-30): that step as the editor
// has it, saved or not, to the team's own email or WhatsApp, for Laura —
// right now, with «[Prueba]» before it. No one in the segment gets anything.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Revisa el paso y a quién va la prueba." }, { status: 400 });
  const { step, eventId, sequenceName, to } = parsed.data;

  const [event, template, orgSettings] = await Promise.all([
    eventId ? db.event.findUnique({ where: { id: eventId } }) : null,
    step.channel === "WHATSAPP" && step.templateId ? db.whatsAppTemplate.findUnique({ where: { id: step.templateId } }) : null,
    getOrgSettings(),
  ]);
  const laura = { id: "muestra", firstName: "Laura", lastName: "Gómez", city: "Bogotá" };
  const ctx = { person: laura, event, sequenceName: sequenceName?.trim() || "Secuencia", timezone: orgSettings.timezone, language: orgSettings.language };
  const content = {
    channel: step.channel,
    subject: step.subject ?? null,
    bodyHtml: step.bodyHtml ?? null,
    buttonText: step.buttonText ?? null,
    buttonTarget: step.buttonTarget ?? null,
    template,
    variableMapping: step.variableMapping ?? {},
  };

  if (step.channel === "EMAIL") {
    const emails = to
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);
    if (!emails.length || emails.length > 5 || emails.some((a) => !z.string().email().safeParse(a).success)) {
      return NextResponse.json({ error: "invalid_email", message: "Escribe hasta 5 correos válidos, separados por coma." }, { status: 400 });
    }
    try {
      for (const email of emails) {
        const r = await sendStep(content, { ...laura, email, phone: null }, ctx, { test: true });
        if (r.status !== "SENT") return NextResponse.json({ error: "not_sent", message: r.detail ?? "No se pudo enviar." }, { status: 400 });
      }
      return NextResponse.json({ ok: true, sent: emails });
    } catch (error) {
      console.error("sequences: test email", error);
      return NextResponse.json({ error: "send_failed", message: `No se pudo enviar la prueba: ${error instanceof Error ? error.message : String(error)}` }, { status: 502 });
    }
  }

  const digits = to.replace(/[^\d+]/g, "");
  const phone = digits.startsWith("+") ? digits : digits.length === 10 ? `+57${digits}` : `+${digits}`;
  if (!/^\+\d{8,15}$/.test(phone)) return NextResponse.json({ error: "invalid_phone", message: "Escribe un número de WhatsApp válido, con su indicativo." }, { status: 400 });
  try {
    const r = await sendStep(content, { ...laura, email: "", phone }, ctx, { test: true });
    if (r.status !== "SENT") return NextResponse.json({ error: "not_sent", message: r.detail ?? "No se pudo enviar." }, { status: 400 });
    return NextResponse.json({ ok: true, sent: [phone] });
  } catch (error) {
    console.error("sequences: test whatsapp", error);
    return NextResponse.json({ error: "send_failed", message: describeWhatsAppSendError(error instanceof Error ? error.message : String(error)) }, { status: 502 });
  }
}
