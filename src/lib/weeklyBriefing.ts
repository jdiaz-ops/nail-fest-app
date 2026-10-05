import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { emailProvider } from "@/lib/email";
import { loadForecastData, loadVelocityData } from "@/lib/eventReportData";
import { goalStatus, pushTiming, weeklyMomentum, PACE_WORDS } from "@/lib/eventDecisions";
import { PACE_STYLE } from "@/lib/registrationVelocity";

// "Briefing semanal" — every Monday (vercel.json cron), one email per
// upcoming published event with what the report page would say today and
// one suggested action, so the decision gets made without opening the
// admin. Same numbers as the page: lib/eventReportData.ts feeds both.

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const fmtRate = (n: number) => (n >= 10 ? fmt(n) : (Math.round(n * 10) / 10).toLocaleString("es-CO"));
const pct = (n: number) => `${Math.round(n * 100)} %`;

export interface BriefingText {
  eventId: string;
  subject: string;
  text: string;
  html: string;
}

export async function buildBriefing(eventId: string): Promise<BriefingText | null> {
  const [orgSettings, event] = await Promise.all([getOrgSettings(), db.event.findUnique({ where: { id: eventId } })]);
  if (!event) return null;
  const { timezone, language } = orgSettings;
  const [vel, fc] = await Promise.all([loadVelocityData(eventId, timezone, language), loadForecastData(eventId, timezone, language)]);
  if (!vel) return null;
  const v = vel.result;
  const forecast = fc?.status === "ok" ? fc.result : null;
  const pace = v.byDaysBefore.pace;
  const weeks = weeklyMomentum(v.target, v.daysBefore, v.comparisons.map((c) => c.curve));
  const lastFull = [...weeks].reverse().find((w) => w.targetDays === 7);
  const prevFull = lastFull ? weeks.find((w) => w.week === lastFull.week - 1) : undefined;
  const weekDiff = lastFull && prevFull && prevFull.target > 0 ? lastFull.target / prevFull.target - 1 : null;
  const timing = pushTiming(v.comparisons.map((c) => c.curve));
  const goal = event.goalRegistrations ? goalStatus(event.goalRegistrations, v.current, v.daysBefore, v.rhythm7) : null;

  const lines: string[] = [];
  lines.push(`${event.name} · faltan ${v.daysBefore} días (${formatDateInTz(event.startsAt, { day: "numeric", month: "long" }, timezone, language)}).`);
  lines.push(
    `Inscritos: ${fmt(v.current)}${lastFull ? ` · última semana completa +${fmt(lastFull.target)}${weekDiff != null ? ` (${weekDiff >= 0 ? "▲ +" : "▼ −"}${pct(Math.abs(weekDiff))} vs. la anterior)` : ""}` : ""}.`
  );
  if (pace && v.byDaysBefore.medianRhythm != null) {
    lines.push(
      `Ritmo: ${fmtRate(v.rhythm7)}/día — ${PACE_STYLE[pace].label}${v.byDaysBefore.paceRatio != null && pace !== "on_track" ? ` ${v.byDaysBefore.paceRatio > 0 ? "+" : "−"}${pct(Math.abs(v.byDaysBefore.paceRatio))}` : ""} frente a los otros eventos a ${v.daysBefore} días (${fmtRate(v.byDaysBefore.medianRhythm)}/día).`
    );
  }
  if (v.byDaysBefore.projection) lines.push(`Proyección final: ~${fmt(v.byDaysBefore.projection.mid)} inscritos (entre ${fmt(v.byDaysBefore.projection.low)} y ${fmt(v.byDaysBefore.projection.high)}).`);
  if (forecast) lines.push(`En puerta: ≈ ${fmt(forecast.forecast.expectedTickets)} entradas (≈ ${fmt(forecast.forecast.expectedPeople)} personas).`);
  if (goal) {
    lines.push(
      goal.remaining === 0
        ? `Meta ${fmt(goal.goal)}: cumplida.`
        : `Meta ${fmt(goal.goal)}: faltan ${fmt(goal.remaining)} — necesitas ${goal.requiredPerDay != null ? fmtRate(goal.requiredPerDay) : "—"}/día, vas a ${fmtRate(goal.currentPerDay)}/día (${PACE_WORDS[goal.light]}).`
    );
  }

  // One suggested action, in priority order.
  let action: string;
  if (goal && goal.light === "red") action = `Subir el ritmo: hace falta un ${pct((goal.requiredPerDay ?? 0) / Math.max(1, goal.currentPerDay) - 1)} más — más pauta o un envío a la base de eventos anteriores.`;
  else if (weekDiff != null && weekDiff < -0.2) action = `La semana bajó ${pct(Math.abs(weekDiff))}: revisa que la pauta siga activa y qué cambió (creativos, presupuesto, audiencias).`;
  else if (timing?.reboundDaysBefore != null && v.daysBefore - timing.reboundDaysBefore <= 7 && v.daysBefore > timing.reboundDaysBefore)
    action = `El repunte final arranca en ~${Math.round(v.daysBefore - timing.reboundDaysBefore)} días: deja listo el presupuesto de los últimos 14 días (~${pct(timing.shareLast14)} del total) y el envío de WhatsApp.`;
  else if (pace === "ahead" && (!goal || goal.light === "green")) action = `Vas adelante: puedes pasar presupuesto de awareness a retargeting${goal ? " o subir la meta" : ""}, y confirmar logística con el escenario alto.`;
  else if (pace === "behind") action = `Vas por debajo de los otros eventos en este punto: prueba un creativo nuevo o una audiencia nueva esta semana, antes del repunte final.`;
  else action = `Mantener: el ritmo está en línea. Revisa el reporte el próximo lunes.`;
  lines.push(`Sugerido: ${action}`);

  const url = `${(process.env.APP_BASE_URL ?? "").replace(/\/$/, "")}/admin/events/${event.id}/reports`;
  const subject = `Briefing · ${event.name} · faltan ${v.daysBefore} días`;
  const text = `${lines.join("\n")}\n\nReporte completo: ${url}`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c1310;max-width:600px"><p><strong>${esc(lines[0]!)}</strong></p>${lines
    .slice(1, -1)
    .map((l) => `<p style="margin:6px 0">${esc(l)}</p>`)
    .join("")}<p style="margin:14px 0;padding:12px 14px;background:#eaf7f1;border-radius:8px"><strong>${esc(lines[lines.length - 1]!)}</strong></p><p><a href="${url}">Ver reporte completo →</a></p></div>`;
  return { eventId: event.id, subject, text, html };
}

/** Sends one briefing per upcoming published in-person/virtual event to
 * OrgSettings.briefingEmails (falling back to replyToEmail). */
export async function sendWeeklyBriefings(onlyEventId?: string): Promise<{ sentTo: string[]; events: number }> {
  const orgSettings = await getOrgSettings();
  const recipients = orgSettings.briefingEmails.length > 0 ? orgSettings.briefingEmails : orgSettings.replyToEmail ? [orgSettings.replyToEmail] : [];
  if (recipients.length === 0) return { sentTo: [], events: 0 };
  const events = await db.event.findMany({
    where: onlyEventId ? { id: onlyEventId } : { status: "PUBLISHED", startsAt: { gt: new Date() } },
    select: { id: true },
  });
  let count = 0;
  for (const e of events) {
    const b = await buildBriefing(e.id);
    if (!b) continue;
    count++;
    for (const to of recipients) {
      await emailProvider.sendTransactional({ to, subject: b.subject, text: b.text, html: b.html, replyTo: orgSettings.replyToEmail ?? undefined });
    }
  }
  return { sentTo: recipients, events: count };
}
