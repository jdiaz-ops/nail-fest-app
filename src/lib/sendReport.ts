// The "how did it really go" email after a difusión / correo: delivered,
// read, failed by reason, duplicates, what the automatic retry did and
// when the next one runs. Sent to OrgSettings.briefingEmails (same list
// as the Monday briefing). Goes out from lib/autoRetry.ts, 30 minutes
// after the send finished — by then Meta/the mail servers have reported
// most deliveries and failures, which they haven't at the moment the
// last message leaves.

import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { emailProvider } from "@/lib/email";
import { getBroadcastFailureBreakdown, getBroadcastStats } from "@/lib/whatsapp/broadcasts";
import { getEmailBroadcastFailureBreakdown, getEmailBroadcastStats } from "@/lib/broadcasts";
import type { AutoRetryOutcome } from "@/lib/autoRetry";

const fmt = (n: number) => n.toLocaleString("es-CO");
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)} %` : "—");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function humanDelay(seconds: number): string {
  if (seconds >= 86400) return `en ${Math.round(seconds / 86400)} día${seconds >= 172800 ? "s" : ""}`;
  if (seconds >= 3600) return `en ${Math.round(seconds / 3600)} h`;
  return `en ${Math.round(seconds / 60)} min`;
}

export async function buildSendReport(channel: "whatsapp" | "email", broadcastId: string, outcome: AutoRetryOutcome | null): Promise<{ subject: string; text: string; html: string } | null> {
  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const lines: string[] = [];
  let subject: string;
  let failuresUrl: string;
  if (channel === "whatsapp") {
    const b = await db.whatsAppBroadcast.findUnique({ where: { id: broadcastId }, include: { template: true, segment: true, event: true } });
    if (!b) return null;
    const [stats, groups] = await Promise.all([getBroadcastStats(b.id), getBroadcastFailureBreakdown(b.id)]);
    const who = b.segment?.name ?? b.event?.name ?? "—";
    subject = `Difusión WhatsApp · ${b.template.name} · ${who}: ${fmt(stats.delivered)} entregados, ${fmt(stats.failed)} fallidos`;
    lines.push(`Difusión "${b.template.name}" a ${who} terminó.`);
    lines.push(`Procesados ${fmt(stats.processed)} · entregados ${fmt(stats.delivered)} (${pct(stats.delivered, stats.processed)}) · leídos ${fmt(stats.read)} (${pct(stats.read, stats.processed)}) · fallidos ${fmt(stats.failed)} (${pct(stats.failed, stats.processed)}).`);
    if (stats.duplicates > 0) lines.push(`Duplicados: ${fmt(stats.duplicates)} números recibieron el mensaje más de una vez.`);
    for (const g of groups) lines.push(`• ${fmt(g.people.length)} — ${g.label}. ${g.action}`);
    failuresUrl = `${base}/admin/crm/whatsapp/difusiones/${b.id}/fallidos`;
  } else {
    const b = await db.emailBroadcast.findUnique({ where: { id: broadcastId }, include: { event: true, segment: true } });
    if (!b) return null;
    const [stats, groups] = await Promise.all([getEmailBroadcastStats(b.id), getEmailBroadcastFailureBreakdown(b.id)]);
    const who = b.event?.name ?? b.segment?.name ?? "—";
    const problems = stats.failed + stats.bounced + stats.complained;
    subject = `Correo · ${b.subject} · ${who}: ${fmt(stats.delivered)} entregados, ${fmt(problems)} con problema`;
    lines.push(`Correo "${b.subject}" a ${who} terminó.`);
    lines.push(`Enviados ${fmt(stats.sent)} · entregados ${fmt(stats.delivered)} (${pct(stats.delivered, stats.sent)}) · abiertos ${fmt(stats.opened)} · clics ${fmt(stats.clicked)} · rebotes ${fmt(stats.bounced)} · fallaron antes de salir ${fmt(stats.failed)}${stats.complained ? ` · quejas de spam ${fmt(stats.complained)}` : ""}.`);
    for (const g of groups) lines.push(`• ${fmt(g.people.length)} — ${g.label}. ${g.action}`);
    failuresUrl = b.eventId ? `${base}/admin/events/${b.eventId}/broadcasts/${b.id}/fallidos` : `${base}/admin/crm/broadcasts`;
  }
  if (outcome) {
    if (outcome.retried === 0) lines.push(`Reintento automático ${outcome.attempt}: no había nada recuperable.`);
    else if (outcome.sent != null) lines.push(`Reintento automático ${outcome.attempt}: ${fmt(outcome.retried)} reintentados, ${fmt(outcome.sent)} entraron.`);
    else lines.push(`Reintento automático ${outcome.attempt}: ${fmt(outcome.retried)} en marcha, los resultados se ven en la lista en unos minutos.`);
    if (outcome.nextInSeconds) lines.push(`Siguiente reintento automático ${humanDelay(outcome.nextInSeconds)}. Después de ese, lo que siga fallando necesita revisión manual.`);
    else lines.push(`No habrá más reintentos automáticos para este envío.`);
  }
  lines.push(`Lo que necesita tu acción está marcado "No reintentar" en la página de fallidos.`);
  const text = `${lines.join("\n")}\n\nFallidos por motivo: ${failuresUrl}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c1310;max-width:640px"><p><strong>${esc(lines[0]!)}</strong></p>${lines
    .slice(1)
    .map((l) => `<p style="margin:6px 0${l.startsWith("•") ? ";padding-left:12px" : ""}">${esc(l)}</p>`)
    .join("")}<p style="margin-top:14px"><a href="${failuresUrl}">Ver fallidos por motivo →</a></p></div>`;
  return { subject, text, html };
}

export async function sendSendReport(channel: "whatsapp" | "email", broadcastId: string, outcome: AutoRetryOutcome | null): Promise<string[]> {
  const orgSettings = await getOrgSettings();
  const recipients = orgSettings.briefingEmails.length > 0 ? orgSettings.briefingEmails : orgSettings.replyToEmail ? [orgSettings.replyToEmail] : [];
  if (recipients.length === 0) return [];
  const report = await buildSendReport(channel, broadcastId, outcome);
  if (!report) return [];
  for (const to of recipients) {
    await emailProvider.sendTransactional({ to, subject: report.subject, text: report.text, html: report.html, replyTo: orgSettings.replyToEmail ?? undefined });
  }
  return recipients;
}
