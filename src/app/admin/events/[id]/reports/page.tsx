import EventDecisionStats from "../../EventDecisionStats";

export const dynamic = "force-dynamic";

// Event reports — the deep pre/post-event analysis (growth curve,
// attribution, city, profession). Deliberately more than Ticket Tailor's
// own "Event reports" page (a pie chart + a table + a timeline, nothing
// about where registrations come from or who they are) — see the
// conversation this was built from: "el event report de tickettailor es
// muy muy pobre".
export default function EventReportsPage({ params }: { params: { id: string } }) {
  return <EventDecisionStats eventId={params.id} />;
}
