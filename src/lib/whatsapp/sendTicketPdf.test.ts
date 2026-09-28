import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("./index", () => ({ whatsappProvider: {} }));
vi.mock("./inbox", () => ({ recordOutboundMessage: vi.fn() }));
vi.mock("@/lib/ticketPdf", () => ({ buildTicketPdfDataForRegistration: vi.fn() }));

import { registrationBelongsToChat } from "./sendTicketPdf";

const chat = { personId: "personA", phone: "573134058607" };

describe("registrationBelongsToChat", () => {
  it("accepts the chat's own contact", () => {
    expect(registrationBelongsToChat({ personId: "personA", person: { phone: null } }, chat)).toBe(true);
  });

  it("accepts another contact registered with the same phone, whatever its format", () => {
    expect(registrationBelongsToChat({ personId: "personB", person: { phone: "+57 313 405 8607" } }, chat)).toBe(true);
  });

  it("rejects a stranger's ticket", () => {
    expect(registrationBelongsToChat({ personId: "personC", person: { phone: "+573001112222" } }, chat)).toBe(false);
    expect(registrationBelongsToChat({ personId: "personC", person: { phone: null } }, chat)).toBe(false);
  });

  it("still matches by phone when the chat has no linked contact", () => {
    expect(registrationBelongsToChat({ personId: "personB", person: { phone: "+573134058607" } }, { personId: null, phone: "573134058607" })).toBe(true);
  });
});
