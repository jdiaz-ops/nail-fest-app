import { db } from "@/lib/db";
import { getCheckoutQuestions } from "@/lib/checkoutForm";
import { getOrgSettings } from "@/lib/settings";
import { buildBuyerFields } from "@/lib/registrationDetails";
import IssuedTicketsTable from "../../IssuedTicketsTable";

export const dynamic = "force-dynamic";

// Issued tickets — every real registration for this event (CONFIRMED or
// CANCELLED; STARTED rows are abandoned carts, they never issued
// anything, see /admin/crm/abandonados for those instead), with the
// buyer's own checkout answers, ticket/check-in status, and the email
// delivery status Ticket Tailor's own order modal highlights ("Email
// bounced" vs "Email opened" — the specific thing the user called out as
// important for deciding who to follow up with).
export default async function IssuedTicketsPage({ params }: { params: { id: string } }) {
  const [registrations, questions, orgSettings] = await Promise.all([
    db.registration.findMany({
      where: { eventId: params.id, status: { in: ["CONFIRMED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      include: {
        person: true,
        ticketType: true,
        scans: { orderBy: { scannedAt: "desc" } },
      },
    }),
    getCheckoutQuestions(),
    getOrgSettings(),
  ]);

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

  const rows = registrations.map((r) => {
    const latestEmail = latestEmailByPerson.get(r.personId) ?? null;
    return {
      id: r.id,
      qrToken: r.qrToken,
      status: r.status as "CONFIRMED" | "CANCELLED",
      createdAt: r.createdAt.toISOString(),
      ticketTypeName: r.ticketType?.name ?? null,
      ticketCount: r.ticketCount,
      checkedInCount: r.checkedInCount,
      buyerFields: buildBuyerFields(questions, r.person, r),
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
    };
  });

  return <IssuedTicketsTable eventId={params.id} rows={rows} timezone={orgSettings.timezone} language={orgSettings.language} />;
}
