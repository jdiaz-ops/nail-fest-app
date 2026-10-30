import type { Person, WhatsAppTemplate } from "@prisma/client";
import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { whatsappProvider } from "@/lib/whatsapp";
import { dynamicUrlButtonIndex } from "@/lib/whatsapp/automations";
import { describeWhatsAppSendError } from "@/lib/whatsapp/failureCategories";
import { recordOutboundMessage } from "@/lib/whatsapp/inbox";
import { renderTemplateBody } from "@/lib/whatsapp/templateText";
import { renderSequenceEmail, sequenceWhatsAppVariables, whatsappButtonPath, type SequenceContext } from "./render";

// One step of a sequence, out to one person (lib/sequences/engine.ts) — or,
// for «Enviar prueba», to the team's own email or WhatsApp. The person's
// permission for the channel is the caller's to check: this sends what
// it's given, through the same providers and logs as the broadcasts — the
// email as marketing, with its unsubscribe link; the WhatsApp in her chat
// in the Bandeja.

export type StepOutcome = { status: "SENT" | "SKIPPED" | "FAILED"; detail: string | null };

export interface StepContent {
  channel: "EMAIL" | "WHATSAPP";
  subject: string | null;
  bodyHtml: string | null;
  buttonText: string | null;
  buttonTarget: string | null;
  template: Pick<WhatsAppTemplate, "id" | "name" | "language" | "status" | "variableCount" | "buttons" | "bodyText"> | null;
  variableMapping: unknown;
}

type To = Pick<Person, "id" | "email" | "phone" | "firstName" | "lastName" | "city">;

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function sendStep(step: StepContent, to: To, ctx: SequenceContext, opts: { test?: boolean } = {}): Promise<StepOutcome> {
  return step.channel === "EMAIL" ? sendEmailStep(step, to, ctx, opts) : sendWhatsAppStep(step, to, ctx, opts);
}

async function sendEmailStep(step: StepContent, to: To, ctx: SequenceContext, opts: { test?: boolean }): Promise<StepOutcome> {
  if (!step.subject?.trim() || !step.bodyHtml?.trim()) return { status: "SKIPPED", detail: "El correo no tiene asunto o texto." };
  // A test's «Darme de baja» leads nowhere real: there's no one to unsubscribe.
  const unsubscribeUrl = opts.test ? `${(process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "")}/privacidad` : buildUnsubscribeUrl(to.id);
  const content = renderSequenceEmail({ subject: step.subject, bodyHtml: step.bodyHtml, buttonText: step.buttonText, buttonTarget: step.buttonTarget }, ctx, unsubscribeUrl);
  if (opts.test) {
    // The team's own inbox: no marketing log, no one's consent.
    await emailProvider.sendTransactional({ to: to.email, subject: `[Prueba] ${content.subject}`, text: content.text, html: content.html });
    return { status: "SENT", detail: null };
  }
  try {
    const sent = await emailProvider.sendMarketing({
      to: to.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      listUnsubscribeHeader: `<${unsubscribeUrl}>`,
    });
    await db.emailLog.create({
      data: { kind: "MARKETING", personId: to.id, toEmail: to.email, providerMessageId: sent.providerMessageId, status: "SENT" },
    });
    return { status: "SENT", detail: null };
  } catch (err) {
    await db.emailLog
      .create({ data: { kind: "MARKETING", personId: to.id, toEmail: to.email, status: "FAILED", errorMessage: errorText(err) } })
      .catch(() => {});
    return { status: "FAILED", detail: errorText(err).slice(0, 300) };
  }
}

async function sendWhatsAppStep(step: StepContent, to: To, ctx: SequenceContext, opts: { test?: boolean }): Promise<StepOutcome> {
  if (!to.phone) return { status: "SKIPPED", detail: "No tiene un WhatsApp registrado." };
  const template = step.template;
  if (!template) return { status: "SKIPPED", detail: "El paso no tiene plantilla (o se borró en Meta)." };
  if (template.status !== "APPROVED") return { status: "SKIPPED", detail: "La plantilla no está aprobada por Meta." };

  const mapping = (step.variableMapping as Record<string, string> | null) ?? {};
  const variables = sequenceWhatsAppVariables(template.variableCount, mapping, ctx);
  const buttonIndex = dynamicUrlButtonIndex(template.buttons);
  let button: { buttonUrlParam: string; buttonIndex: number } | null = null;
  if (buttonIndex >= 0) {
    const path = whatsappButtonPath(ctx.event, step.buttonTarget);
    if (!path) return { status: "SKIPPED", detail: "La plantilla tiene un botón con enlace y la secuencia no tiene evento." };
    button = { buttonUrlParam: path, buttonIndex };
  }

  const body = `${opts.test ? "[Prueba] " : ""}${renderTemplateBody(template.bodyText, variables)}`;
  try {
    const result = await whatsappProvider.sendTemplate({ to: to.phone, templateName: template.name, languageCode: template.language, variables, ...(button ?? {}) });
    await recordOutboundMessage({ phone: to.phone, kind: "TEMPLATE", body, templateId: template.id, providerMessageId: result.providerMessageId, status: "SENT" });
    return { status: "SENT", detail: null };
  } catch (err) {
    await recordOutboundMessage({ phone: to.phone, kind: "TEMPLATE", body, templateId: template.id, status: "FAILED", errorMessage: errorText(err) }).catch(() => {});
    if (opts.test) throw err;
    return { status: "FAILED", detail: describeWhatsAppSendError(errorText(err)) };
  }
}
