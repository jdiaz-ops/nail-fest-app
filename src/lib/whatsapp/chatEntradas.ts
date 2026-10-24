import { chatRegistrationOwners, listResendableRegistrations } from "./sendTicketPdf";
import { listEditionRegistrations } from "@/lib/registrationWithdrawal";

/** A Bandeja chat's "Entradas", the latest event first: the tickets it
 * can resend, plus the ones taken out of this edition — no longer
 * resendable, still listed so the retire can be undone (in the same
 * place, so nothing jumps on the tap). `edition` is set when the event
 * is still ahead, for "Retirar de esta edición" / "Deshacer" (see
 * lib/registrationWithdrawal.ts). */
export async function listChatEntradas(chat: { personId: string | null; phone: string }) {
  const [resendable, edition] = await Promise.all([listResendableRegistrations(chat), listEditionRegistrations(chatRegistrationOwners(chat))]);
  const byId = new Map(edition.map((r) => [r.id, r]));
  const out = edition.filter((r) => r.state === "out" && !resendable.some((x) => x.id === r.id));
  return [...resendable, ...out]
    .sort((a, b) => b.event.startsAt.getTime() - a.event.startsAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
    .map((r) => {
      const e = byId.get(r.id);
      return {
        id: r.id,
        event: r.event,
        ticketCount: r.ticketCount,
        // Same phone, but a different CRM contact than the chat's (e.g.
        // registered again with another email): whose it is.
        ownerEmail: r.personId !== chat.personId ? r.person.email : null,
        edition: e ? { state: e.state, cancelledAt: e.cancelledAt, cancelledBy: e.cancelledBy } : null,
      };
    });
}
