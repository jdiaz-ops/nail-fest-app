import { db } from "@/lib/db";

// The person profile / lifecycle page (see /admin/crm/personas/[id]) —
// merges every table that already logs something about a Person into one
// chronological history, instead of an admin having to check Registrations,
// ScanLog, Consent, MetaEvent and EmailLog separately. Nothing new is
// tracked here beyond what those tables already record (plus EmailLog's
// new open/click timestamps — see docs/SES_EVENT_TRACKING.md).

export type TimelineItemType =
  | "REGISTRATION"
  | "SCAN"
  | "CONSENT"
  | "META_EVENT"
  | "EMAIL_SENT"
  | "EMAIL_DELIVERED"
  | "EMAIL_OPENED"
  | "EMAIL_CLICKED"
  | "EMAIL_BOUNCED"
  | "EMAIL_COMPLAINED";

export interface TimelineItem {
  type: TimelineItemType;
  at: Date;
  title: string;
  detail?: string;
}

export type LifecycleStage = "LEAD" | "REGISTRADO" | "ASISTIO" | "RECURRENTE" | "INACTIVO";

export const LIFECYCLE_LABEL: Record<LifecycleStage, string> = {
  LEAD: "Lead",
  REGISTRADO: "Registrado",
  ASISTIO: "Asistió",
  RECURRENTE: "Recurrente",
  INACTIVO: "Inactivo",
};

// A registration or event older than this with no newer activity of any
// kind reads as "inactive" regardless of how engaged they were before —
// a real threshold, not a placeholder, but a first guess: revisit once
// there's enough real data to see what "came back" actually looks like.
const INACTIVE_AFTER_DAYS = 180;

export interface PersonProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  profession: string | null;
  createdAt: Date;
  stage: LifecycleStage;
  eventsAttended: number;
  registrationsTotal: number;
  lastActivityAt: Date | null;
  timeline: TimelineItem[];
  consents: { purpose: string; granted: boolean; at: Date }[];
}

export async function getPersonProfile(personId: string): Promise<PersonProfile | null> {
  const person = await db.person.findUnique({ where: { id: personId } });
  if (!person) return null;

  const [registrations, scans, consents, metaEvents, emailLogs] = await Promise.all([
    db.registration.findMany({
      where: { personId },
      include: { event: true, ticketType: true },
      orderBy: { createdAt: "desc" },
    }),
    db.scanLog.findMany({
      where: { registration: { personId } },
      include: { scannedForEvent: true },
      orderBy: { scannedAt: "desc" },
    }),
    db.consent.findMany({
      where: { personId },
      orderBy: { grantedAt: "desc" },
    }),
    db.metaEvent.findMany({
      where: { registration: { personId }, status: "SENT" },
      orderBy: { sentAt: "desc" },
    }),
    db.emailLog.findMany({
      where: { personId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const timeline: TimelineItem[] = [];

  for (const r of registrations) {
    const ticketLabel = r.ticketType
      ? `${r.ticketType.name}${r.ticketCount > 1 ? ` ×${r.ticketCount}` : ""}`
      : undefined;
    timeline.push({
      type: "REGISTRATION",
      at: r.createdAt,
      title: `Se registró para ${r.event.name}`,
      detail: ticketLabel,
    });
  }

  const validScans = scans.filter((s) => s.result === "VALID_FIRST" || s.result === "VALID_REENTRY");
  for (const s of scans) {
    const label =
      s.result === "VALID_FIRST"
        ? "Escaneo de entrada"
        : s.result === "VALID_REENTRY"
          ? "Escaneo de re-ingreso"
          : s.result === "WRONG_EVENT"
            ? "Escaneo — boleto de otro evento"
            : "Escaneo — código inválido";
    timeline.push({
      type: "SCAN",
      at: s.scannedAt,
      title: label,
      detail: s.scannedForEvent?.name,
    });
  }

  for (const c of consents) {
    timeline.push({
      type: "CONSENT",
      at: c.revokedAt ?? c.grantedAt,
      title: c.revokedAt
        ? `Revocó el consentimiento de ${consentLabel(c.purpose)}`
        : c.granted
          ? `Autorizó ${consentLabel(c.purpose)}`
          : `No autorizó ${consentLabel(c.purpose)}`,
    });
  }

  for (const m of metaEvents) {
    if (!m.sentAt) continue;
    timeline.push({
      type: "META_EVENT",
      at: m.sentAt,
      title: `Evento ${m.eventName} enviado a Meta (CAPI)`,
    });
  }

  for (const e of emailLogs) {
    timeline.push({ type: "EMAIL_SENT", at: e.createdAt, title: "Correo enviado", detail: e.toEmail });
    if (e.deliveredAt) timeline.push({ type: "EMAIL_DELIVERED", at: e.deliveredAt, title: "Correo entregado" });
    if (e.openedAt) timeline.push({ type: "EMAIL_OPENED", at: e.openedAt, title: "Abrió el correo" });
    if (e.firstClickedAt) timeline.push({ type: "EMAIL_CLICKED", at: e.firstClickedAt, title: "Clic en el correo" });
    if (e.bouncedAt) timeline.push({ type: "EMAIL_BOUNCED", at: e.bouncedAt, title: "Correo rebotado" });
    if (e.complainedAt) timeline.push({ type: "EMAIL_COMPLAINED", at: e.complainedAt, title: "Marcó el correo como spam" });
  }

  timeline.sort((a, b) => b.at.getTime() - a.at.getTime());

  const distinctEventsRegistered = new Set(registrations.map((r) => r.eventId));
  const distinctEventsAttended = new Set(validScans.map((s) => s.scannedForEventId).filter(Boolean));
  const lastActivityAt = timeline[0]?.at ?? null;

  let stage: LifecycleStage;
  if (registrations.length === 0) {
    stage = "LEAD";
  } else if (distinctEventsRegistered.size >= 2 || distinctEventsAttended.size >= 2) {
    stage = "RECURRENTE";
  } else if (distinctEventsAttended.size >= 1) {
    stage = "ASISTIO";
  } else {
    stage = "REGISTRADO";
  }
  if (stage !== "LEAD" && lastActivityAt) {
    const daysSince = (Date.now() - lastActivityAt.getTime()) / 86_400_000;
    if (daysSince > INACTIVE_AFTER_DAYS) stage = "INACTIVO";
  }

  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: person.phone,
    city: person.city,
    profession: person.profession,
    createdAt: person.createdAt,
    stage,
    eventsAttended: distinctEventsAttended.size,
    registrationsTotal: registrations.length,
    lastActivityAt,
    timeline,
    consents: consents.map((c) => ({ purpose: c.purpose, granted: c.granted && !c.revokedAt, at: c.revokedAt ?? c.grantedAt })),
  };
}

function consentLabel(purpose: string): string {
  switch (purpose) {
    case "LOGISTICS":
      return "el tratamiento de datos para logística";
    case "MARKETING":
      return "marketing";
    case "ADVERTISING":
      return "publicidad";
    case "WHATSAPP":
      return "WhatsApp";
    default:
      return purpose;
  }
}
