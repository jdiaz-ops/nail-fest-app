import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/settings", () => ({ getOrgSettings: vi.fn() }));
vi.mock("@/lib/imparables/promo", () => ({ ticketBannerFor: vi.fn() }));

import { SAMPLE_QR_TOKEN, renderTicketPdfBuffer, type TicketPdfData } from "./ticketPdf";
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

  it("a token that doesn't verify still gives its one ticket; the sample's, the order's", async () => {
    vi.stubEnv("APP_SECRET_KEY", "secreto-de-prueba");
    const one = await renderTicketPdfBuffer({ ...base(), qrToken: "UNA-QUE-NO-VERIFICA", ticketCount: 2 });
    expect(pageCount(one)).toBe(1);
    const sample = await renderTicketPdfBuffer({ ...base(), qrToken: SAMPLE_QR_TOKEN, ticketCount: 3 });
    expect(pageCount(sample)).toBe(2);
  });

  it("with Manicuristas Imparables' banner: all of it a link to the congress's page, in its faces", async () => {
    vi.stubEnv("APP_SECRET_KEY", "secreto-de-prueba");
    const url = "https://nailfest.lat/imparables?utm_source=nailfest&utm_medium=pdf_entrada&utm_campaign=cucuta&utm_content=banner_imparables";
    const data = { ...base(), qrToken: issueQrToken("cmvlbk6ab0007dn89u4wj94y2"), imparables: { url, date: "4 de julio 2027", note: "Congreso virtual en vivo" } };
    for (const ticketCount of [1, 2]) {
      const pdf = (await renderTicketPdfBuffer({ ...data, ticketCount })).toString("latin1");
      expect(pageCount(Buffer.from(pdf, "latin1"))).toBe(1);
      expect(pdf.match(/\/URI \(([^)]*)\)/)?.[1]).toBe(url);
      expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Cinzel/);
      expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Manrope/);
    }
    // Three tickets: on the last page only.
    const three = (await renderTicketPdfBuffer({ ...data, ticketCount: 3 })).toString("latin1");
    expect(three.match(/\/URI \(/g)).toHaveLength(1);
  });

  it("without it, the ticket as always: no link", async () => {
    vi.stubEnv("APP_SECRET_KEY", "secreto-de-prueba");
    const pdf = (await renderTicketPdfBuffer({ ...base(), qrToken: issueQrToken("r1"), ticketCount: 2, imparables: null })).toString("latin1");
    expect(pdf).not.toContain("/URI");
    expect(pdf).not.toMatch(/\+Cinzel/);
  });
});
