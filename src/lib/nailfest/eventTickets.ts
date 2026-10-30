import { confirmationCodeFor, issueQrToken, ticketHolderName, ticketsFor } from "@/lib/ticket";
import { ticketCard, type NailFestTicket } from "./confirmationEmail";

// «{{BOLETA}}» in an event's email (Correos del evento, 2026-10-30, the
// team): where it's written, each person sees her ticket — its QR, her name,
// what kind, her code — and, when her order brought companions, each of
// theirs, in the confirmation's card (confirmationEmail.ts' ticketCard).
// Without a ticket (no QR yet), nothing there.

export const TICKET_TAG = "{{BOLETA}}";

export interface OrderTickets {
  /** Hers first, then her companions'. */
  list: NailFestTicket[];
  /** How many people her order lets in. */
  people: number;
  pdfAttached: boolean;
}

/** Her order's tickets as her confirmation gave them (sendTicketEmail.ts): one, or one per person it lets in. */
export function orderTickets(
  base: string,
  registration: { id: string; qrToken: string | null; ticketCount: number | null },
  holder: string,
  typeName: string | null
): NailFestTicket[] {
  if (!registration.qrToken) return [];
  const count = registration.ticketCount ?? 1;
  if (count <= 1) {
    return [{ qrImageUrl: `${base}/api/ticket-qr/${registration.qrToken}`, holder, label: typeName ?? "Entrada general", code: confirmationCodeFor(registration.id) }];
  }
  return ticketsFor(registration.id, count).map((t) => ({
    qrImageUrl: `${base}/api/ticket-qr/${t.ticketNumber === 1 ? registration.qrToken : t.qrToken}`,
    holder: ticketHolderName(holder, t.ticketNumber),
    label: `${typeName ?? "Entrada"} · ${t.ticketNumber} de ${count}`,
    code: t.confirmationCode,
  }));
}

/** Laura's ticket, for previews and test emails (as the confirmation's preview). */
export function sampleTickets(base: string, typeName: string | null, pdfAttached: boolean): OrderTickets {
  return {
    list: [{ qrImageUrl: `${base}/api/ticket-qr/${issueQrToken("EJEMPLO")}`, holder: "Laura Gómez", label: typeName ?? "Entrada general", code: "EJEMPLO1" }],
    people: 1,
    pdfAttached,
  };
}

/** Her tickets as the confirmation's cards, one under the other — the people it lets in on a single one, as there. */
export function ticketCards(tickets: OrderTickets, eventName: string): string {
  const people = tickets.list.length === 1 ? `${tickets.people} ${tickets.people === 1 ? "persona" : "personas"}` : null;
  return tickets.list
    .map((t, i) => `<div style="margin:${i ? 14 : 4}px 0 ${i === tickets.list.length - 1 ? 16 : 0}px;">${ticketCard(t, eventName, { people, pdfAttached: tickets.pdfAttached })}</div>`)
    .join("");
}

/** The same in words, for the email's text. */
export function ticketLines(tickets: OrderTickets): string {
  return tickets.list.map((t) => [`TU ENTRADA`, `${t.holder} · ${t.label}`, `Código: ${t.code}`, `Tu código QR: ${t.qrImageUrl}`].join("\n")).join("\n\n");
}

const words = (html: string) => html.replace(/<[^>]+>|&nbsp;/g, "").trim();

/** A body with its tag on a paragraph of its own, whatever was written around it staying before and after. */
export function isolateTicketTag(bodyHtml: string): string {
  if (!bodyHtml.includes(TICKET_TAG)) return bodyHtml;
  return bodyHtml.replace(/<p\b([^>]*)>((?:(?!<\/p>)[\s\S])*?)\{\{BOLETA\}\}((?:(?!<\/p>)[\s\S])*?)<\/p>/g, (_, attrs: string, before: string, after: string) => {
    const trim = (html: string) => html.replace(/^(?:\s|&nbsp;|<br\s*\/?>)+|(?:\s|&nbsp;|<br\s*\/?>)+$/g, "");
    return `${words(before) ? `<p${attrs}>${trim(before)}</p>` : ""}<p>${TICKET_TAG}</p>${words(after) ? `<p${attrs}>${trim(after)}</p>` : ""}`;
  });
}

/** A body with her cards where its tag is (on its own line or not), or without the tag when there are none. */
export function withTickets(bodyHtml: string, cards: string): string {
  if (!bodyHtml.includes(TICKET_TAG)) return bodyHtml;
  return isolateTicketTag(bodyHtml).split(`<p>${TICKET_TAG}</p>`).join(cards).split(TICKET_TAG).join("");
}
