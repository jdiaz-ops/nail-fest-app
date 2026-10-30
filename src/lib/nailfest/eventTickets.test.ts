import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ticket", () => ({
  confirmationCodeFor: (id: string, n = 1) => `${id.slice(-4).toUpperCase()}${n}`,
  issueQrToken: (id: string, n = 1) => `${id}.${n}.sig`,
  ticketHolderName: (titular: string, n: number) => (n === 1 ? titular : `Acompañante de ${titular}`),
  ticketsFor: (id: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ ticketNumber: i + 1, qrToken: `${id}.${i + 1}.sig`, confirmationCode: `${id.slice(-4).toUpperCase()}${i + 1}` })),
}));

import { isolateTicketTag, orderTickets, ticketCards, ticketLines, withTickets } from "./eventTickets";

describe("«{{BOLETA}}»: her ticket in an event's email", () => {
  it("one ticket: hers, with her stored QR", () => {
    expect(orderTickets("https://nailfest.lat", { id: "reg_abcd", qrToken: "tok", ticketCount: 1 }, "Laura Gómez", "General")).toEqual([
      { qrImageUrl: "https://nailfest.lat/api/ticket-qr/tok", holder: "Laura Gómez", label: "General", code: "ABCD1" },
    ]);
  });

  it("with a companion: hers first, then the companion's, each with its own QR", () => {
    const list = orderTickets("https://nailfest.lat", { id: "reg_abcd", qrToken: "tok", ticketCount: 2 }, "Laura Gómez", "General");
    expect(list.map((t) => [t.holder, t.label, t.qrImageUrl])).toEqual([
      ["Laura Gómez", "General · 1 de 2", "https://nailfest.lat/api/ticket-qr/tok"],
      ["Acompañante de Laura Gómez", "General · 2 de 2", "https://nailfest.lat/api/ticket-qr/reg_abcd.2.sig"],
    ]);
    const cards = ticketCards({ list, people: 2, pdfAttached: true }, "Nail Fest Cúcuta");
    expect(cards.match(/Código QR de tu entrada/g)).toHaveLength(2);
    expect(cards).not.toContain("2 personas");
    expect(cards).toContain("También va en PDF adjunto");
    expect(ticketLines({ list, people: 2, pdfAttached: true })).toContain("Acompañante de Laura Gómez · General · 2 de 2");
  });

  it("none without a QR", () => {
    expect(orderTickets("https://nailfest.lat", { id: "reg_abcd", qrToken: null, ticketCount: 1 }, "Laura", null)).toEqual([]);
  });

  it("the tag on a line of its own, whatever was around it kept before and after", () => {
    expect(isolateTicketTag("<p>Tu entrada: {{BOLETA}} ¡Nos vemos!</p>")).toBe("<p>Tu entrada:</p><p>{{BOLETA}}</p><p>¡Nos vemos!</p>");
    expect(isolateTicketTag("<p><strong>{{BOLETA}}</strong></p>")).toBe("<p>{{BOLETA}}</p>");
    expect(withTickets("<p>Hola</p><p>{{BOLETA}}</p>", "[cards]")).toBe("<p>Hola</p>[cards]");
    expect(withTickets("<p>Hola {{BOLETA}}</p>", "")).toBe("<p>Hola</p>");
  });
});
