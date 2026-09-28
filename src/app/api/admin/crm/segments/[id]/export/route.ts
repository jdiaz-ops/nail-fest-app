import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { findCountry } from "@/lib/worldCountries";
import { bulkActiveConsent } from "@/lib/consent";
import { getCheckoutQuestions } from "@/lib/checkoutForm";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";

// Same audience a broadcast to this segment would actually reach —
// resolveSegment is the one place that logic lives (builder.ts), so this
// is guaranteed to match what Difusiones/Broadcasts would send to, not a
// second copy of the filter logic that could drift. Real-world use:
// pulling a segment into a spreadsheet for someone outside this app
// (a caller list for the door team, a one-off analysis) — not itself a
// send, so it isn't gated on any consent purpose the way an actual
// broadcast is; whoever downloads this is responsible for what they do
// with it next, same as any CRM export.
//
// One row per person (a segment is a set of people), carrying everything
// the CRM knows about them: the profile, labels, consents, every event
// they registered for / attended, and the details of their most recent
// registration — including the answers to every custom checkout question
// as its own column, which is what "exportar todo" really meant.
export const maxDuration = 60;

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  // RFC4180: quote whenever the cell contains a comma, quote, or newline;
  // an embedded quote doubles.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Postgres caps bound parameters per query; a big segment's id list goes
// through in slices well under it.
async function inChunks<T>(ids: string[], fn: (slice: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 5000) out.push(...(await fn(ids.slice(i, i + 5000))));
  return out;
}

const STATUS_LABELS: Record<string, string> = {
  STARTED: "Iniciado",
  PENDING_PAYMENT: "Pago pendiente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const segment = await db.segmentDefinition.findUnique({ where: { id: params.id } });
  if (!segment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [people, questions, orgSettings] = await Promise.all([
    resolveSegment(segment.filter as unknown as SegmentFilter),
    getCheckoutQuestions(),
    getOrgSettings(),
  ]);
  const ids = people.map((p) => p.id);
  // Locked questions already map to real Person columns (name, email,
  // phone, city, profession) — cedula is the one locked answer that only
  // lives in customFields, so it gets its own fixed column below.
  const customQuestions = questions.filter((q) => !q.locked);

  const [registrations, labelRows, marketing, whatsapp, advertising] = await Promise.all([
    inChunks(ids, (slice) =>
      db.registration.findMany({
        where: { personId: { in: slice } },
        orderBy: { createdAt: "desc" },
        include: { event: { select: { name: true } }, ticketType: { select: { name: true } } },
      })
    ),
    inChunks(ids, (slice) => db.person.findMany({ where: { id: { in: slice } }, select: { id: true, labels: { select: { name: true } } } })),
    bulkActiveConsent(ids, "MARKETING"),
    bulkActiveConsent(ids, "WHATSAPP"),
    bulkActiveConsent(ids, "ADVERTISING"),
  ]);

  const registrationsByPerson = new Map<string, typeof registrations>();
  for (const r of registrations) {
    const list = registrationsByPerson.get(r.personId);
    if (list) list.push(r);
    else registrationsByPerson.set(r.personId, [r]);
  }
  const labelsByPerson = new Map(labelRows.map((p) => [p.id, p.labels.map((l) => l.name).join("; ")]));

  const date = (d: Date | null | undefined) => (d ? formatDateInTz(d, { dateStyle: "short", timeStyle: "short" }, orgSettings.timezone, orgSettings.language) : "");
  const yesNo = (v: boolean) => (v ? "Sí" : "No");
  const fields = (r: (typeof registrations)[number] | undefined): Record<string, unknown> =>
    r && r.customFields && typeof r.customFields === "object" && !Array.isArray(r.customFields) ? (r.customFields as Record<string, unknown>) : {};
  // Most recent registration first (see orderBy above); an answer missing
  // there is looked for in the person's older registrations before giving up.
  const answer = (list: typeof registrations, key: string): string => {
    for (const r of list) {
      const v = fields(r)[key];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };

  const header = [
    "Nombre",
    "Apellido",
    "Correo",
    "Teléfono",
    "Cédula",
    "Ciudad",
    "País",
    "Profesión",
    "Etiquetas",
    "Consentimiento correo",
    "Consentimiento WhatsApp",
    "Consentimiento publicidad",
    "Fecha de registro",
    "Eventos registrados",
    "Eventos asistidos",
    "Último evento",
    "Código de confirmación",
    "Estado",
    "Tipo de entrada",
    "Entradas",
    "Escaneadas",
    "Inscripción",
    "Confirmado",
    "Fuente (utm_source)",
    "Medio (utm_medium)",
    "Campaña (utm_campaign)",
    ...customQuestions.map((q) => q.label),
  ];

  const rows = people.map((p) => {
    const list = registrationsByPerson.get(p.id) ?? [];
    const latest = list[0];
    const confirmed = list.filter((r) => r.status === "CONFIRMED");
    return [
      p.firstName,
      p.lastName,
      p.email,
      p.phone,
      answer(list, "cedula"),
      p.city,
      p.country ? (findCountry(p.country)?.name ?? p.country) : null,
      p.profession,
      labelsByPerson.get(p.id) ?? "",
      yesNo(marketing.has(p.id)),
      yesNo(whatsapp.has(p.id)),
      yesNo(advertising.has(p.id)),
      p.createdAt.toISOString().slice(0, 10),
      [...new Set(confirmed.map((r) => r.event.name))].join("; "),
      [...new Set(list.filter((r) => r.checkedInCount > 0).map((r) => r.event.name))].join("; "),
      latest?.event.name ?? "",
      // The same 8-character code the confirmation email shows (see
      // sendTicketEmail.ts) — never the QR token itself, which works as
      // the entry pass and would turn this file into a stack of tickets.
      latest?.status === "CONFIRMED" ? latest.id.slice(-8).toUpperCase() : "",
      latest ? (STATUS_LABELS[latest.status] ?? latest.status) : "",
      latest?.ticketType?.name ?? "",
      latest ? latest.ticketCount : "",
      latest ? latest.checkedInCount : "",
      date(latest?.createdAt),
      date(latest?.confirmedAt),
      latest?.utmSource ?? "",
      latest?.utmMedium ?? "",
      latest?.utmCampaign ?? "",
      ...customQuestions.map((q) => answer(list, q.key)),
    ]
      .map(csvCell)
      .join(",");
  });
  // Leading BOM so Excel (the realistic destination for a "descargar CSV"
  // click) reads UTF-8 accents (Bogotá, Rodríguez) correctly instead of
  // mangling them — harmless to any other CSV reader.
  const csv = "﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n") + "\r\n";

  // Filename built from the segment's own name — sanitized to something
  // every OS/browser accepts as a bare filename (no slashes, no quotes).
  const safeName = segment.name.replace(/[^\p{L}\p{N}\s._-]/gu, "").trim().replace(/\s+/g, "-") || "segmento";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.csv"`,
    },
  });
}
