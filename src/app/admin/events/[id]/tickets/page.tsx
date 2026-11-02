import { db } from "@/lib/db";
import { getCheckoutQuestions } from "@/lib/checkoutForm";
import { getOrgSettings } from "@/lib/settings";
import { buildBuyerFields } from "@/lib/registrationDetails";
import { ticketIssuedAt } from "@/lib/ticketIssuedAt";
import { formatPaid, paidTotal } from "@/lib/payments/paidTotal";
import IssuedTicketsTable from "../../IssuedTicketsTable";

export const dynamic = "force-dynamic";

// Issued tickets — every real registration for this event (CONFIRMED or
// CANCELLED; STARTED rows are abandoned carts, they never issued
// anything, see /admin/crm/abandonados for those instead), with the
// buyer's own checkout answers, ticket/check-in status, and the email
// delivery status our previous ticketing platform's own order modal
// highlights ("Email bounced" vs "Email opened" — the specific thing the user called out as
// important for deciding who to follow up with).
export default async function IssuedTicketsPage({ params }: { params: { id: string } }) {
  const [event, registrations, questions, orgSettings] = await Promise.all([
    db.event.findUnique({ where: { id: params.id }, select: { format: true, zoomMeetingId: true } }),
    db.registration.findMany({
      where: { eventId: params.id, status: { in: ["CONFIRMED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      include: {
        person: true,
        ticketType: true,
        scans: { orderBy: { scannedAt: "desc" } },
        // Its payments that went through (approved, or refunded in full since): what she paid (lib/payments/
        // paidTotal.ts), and, with its confirmation, the day it was issued (lib/ticketIssuedAt.ts).
        payments: {
          where: { status: { in: ["APPROVED", "REFUNDED"] } },
          orderBy: { createdAt: "desc" },
          select: { status: true, amountInCents: true, refundedCents: true, currency: true, upgradeFrom: true, createdAt: true },
        },
      },
    }),
    getCheckoutQuestions(),
    getOrgSettings(),
  ]);
  // Whether THIS event even has a Zoom access concept at all — drives
  // whether IssuedTicketsTable shows the "Zoom" column/section at all
  // (a presencial event has nothing to show there).
  const hasZoomAccess = Boolean(event && event.format !== "IN_PERSON" && event.zoomMeetingId);

  const personIds = registrations.map((r) => r.personId);
  // Latest TRANSACTIONAL email per person (the ticket-confirmation send,
  // not a marketing broadcast — broadcastId is null for those, see
  // sendTicketEmail.ts) — one query for the whole list instead of one per
  // row, then picked per-person client-side.
  const emailLogs =
    personIds.length > 0
      ? await db.emailLog.findMany({
          where: { personId: { in: personIds }, kind: "TRANSACTIONAL", broadcastId: null },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const latestEmailByPerson = new Map<string, (typeof emailLogs)[number]>();
  for (const log of emailLogs) {
    if (log.personId && !latestEmailByPerson.has(log.personId)) latestEmailByPerson.set(log.personId, log);
  }

  // Newest issued first: by the day each was paid, not the day its row was first created (lib/ticketIssuedAt.ts).
  const issued = registrations
    .map((r) => ({ r, issuedAt: ticketIssuedAt(r, r.payments.find((p) => p.status === "APPROVED" && !p.upgradeFrom)?.createdAt) }))
    .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());

  const rows = issued.map(({ r, issuedAt }) => {
    const latestEmail = latestEmailByPerson.get(r.personId) ?? null;
    return {
      id: r.id,
      qrToken: r.qrToken,
      status: r.status as "CONFIRMED" | "CANCELLED",
      issuedAt: issuedAt.toISOString(),
      // "—" in the table: nothing paid through Nail Fest (free, or imported from the previous platform).
      paid: formatPaid(paidTotal(r.payments)) ?? (r.payments.some((p) => p.status === "REFUNDED") ? "Reembolsado" : null),
      ticketTypeName: r.ticketType?.name ?? null,
      ticketCount: r.ticketCount,
      checkedInCount: r.checkedInCount,
      buyerFields: buildBuyerFields(questions, r.person, r),
      cedula: typeof (r.customFields as Record<string, unknown> | null)?.cedula === "string" ? ((r.customFields as Record<string, unknown>).cedula as string) : null,
      person: {
        firstName: r.person.firstName,
        lastName: r.person.lastName,
        email: r.person.email,
        phone: r.person.phone,
        city: r.person.city,
        profession: r.person.profession,
      },
      scans: r.scans.map((s) => ({ scannedAt: s.scannedAt.toISOString(), result: s.result, scannerLabel: s.scannerLabel })),
      emailStatus: latestEmail?.status ?? null,
      emailAt: latestEmail
        ? (latestEmail.openedAt ?? latestEmail.deliveredAt ?? latestEmail.bouncedAt ?? latestEmail.createdAt).toISOString()
        : null,
      utmSource: r.utmSource,
      zoomJoinUrl: r.zoomJoinUrl,
    };
  });

  return (
    <IssuedTicketsTable eventId={params.id} rows={rows} timezone={orgSettings.timezone} language={orgSettings.language} hasZoomAccess={hasZoomAccess} />
  );
}
