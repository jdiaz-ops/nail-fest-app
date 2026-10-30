import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/settings", () => ({ getOrgSettings: vi.fn() }));

import { renderTicketPdfBuffer, type TicketPdfData } from "./ticketPdf";
import { issueQrToken } from "./ticket";

const base = (): TicketPdfData => ({
  firstName: "Laura",
  lastName: "Gómez",
  eventName: "Nail Fest Cúcuta",
  venueName: "Hotel Casino Internacional",
  venueAddress: "Cl 11 # 2E-75 - Los Caobos",
  city: "Cúcuta",
  startsAt: new Date("2026-11-07T15:00:00Z"),
  endsAt: new Date("2026-11-08T22:00:00Z"),
  scheduleDays: [
    { opensAt: "2026-11-07T15:00:00Z", closesAt: "2026-11-07T23:00:00Z" },
    { opensAt: "2026-11-08T15:00:00Z", closesAt: "2026-11-08T22:00:00Z" },
  ],
  ticketTypeName: "Entrada Gratis",
  confirmationCode: "U4WJ94Y2",
  qrToken: "",
  timezone: "America/Bogota",
  language: "es",
});
const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

describe("the ticket's PDF (boceto 3)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("one ticket, one page; an order's tickets two to a page", async () => {
    vi.stubEnv("APP_SECRET_KEY", "secreto-de-prueba");
    const data = { ...base(), qrToken: issueQrToken("cmvlbk6ab0007dn89u4wj94y2") };
    const one = await renderTicketPdfBuffer({ ...data, ticketCount: 1 });
    expect(one.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(one)).toBe(1);
    expect(pageCount(await renderTicketPdfBuffer({ ...data, ticketCount: 2 }))).toBe(1);
    expect(pageCount(await renderTicketPdfBuffer({ ...data, ticketCount: 3 }))).toBe(2);
  });

  it("in the event page's faces, embedded", async () => {
    vi.stubEnv("APP_SECRET_KEY", "secreto-de-prueba");
    const pdf = (await renderTicketPdfBuffer({ ...base(), qrToken: issueQrToken("r1") })).toString("latin1");
    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Fraunces/);
    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Inter/);
  });

  it("a sample token that doesn't verify still gives its one ticket", async () => {
    vi.stubEnv("APP_SECRET_KEY", "secreto-de-prueba");
    const pdf = await renderTicketPdfBuffer({ ...base(), qrToken: "VISTA-PREVIA-NO-ES-UNA-ENTRADA-REAL", ticketCount: 2 });
    expect(pageCount(pdf)).toBe(1);
  });
});
